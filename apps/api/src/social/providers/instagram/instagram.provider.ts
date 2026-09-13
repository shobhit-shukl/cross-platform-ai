import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { createReadStream } from 'fs';
import {
  ExternalAccount,
  ListPostsResult,
  OAuthTokens,
  PublishResult,
  SocialProvider,
} from '../social-provider.interface';
import {
  FileUploadError,
  InsufficientScopeError,
  IntegrationNotConfiguredError,
  NoInstagramAccountError,
  OAuthExchangeError,
  QuotaExceededError,
  TokenRefreshError,
} from '../../social.errors';

const GRAPH_API_VERSION = 'v21.0'; // Bump periodically — Meta deprecates versions ~2 years after release.
const IG_AUTH_URL = 'https://api.instagram.com/oauth/authorize';
const IG_CODE_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const IG_RUPLOAD_URL = `https://rupload.facebook.com/ig-api-upload/${GRAPH_API_VERSION}`;

// Meta recommends polling the container's status_code, not assuming it's ready
// immediately after the upload call returns. Most Reels finish in well under a minute;
// this caps the wait rather than polling forever on a stuck/expired container.
const CONTAINER_POLL_INTERVAL_MS = 3000;
const CONTAINER_POLL_MAX_ATTEMPTS = 100; // ~5 minutes, matching Meta's documented window

interface InstagramShortLivedTokenResponse {
  access_token?: string;
  user_id?: number | string;
  error_message?: string;
  error_type?: string;
}

interface InstagramLongLivedTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

interface InstagramMeResponse {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  error?: { message?: string; code?: number };
}

interface InstagramMediaContainer {
  id?: string;
  error?: { message?: string; code?: number };
}

interface InstagramContainerStatus {
  status_code?: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
  status?: string;
  error?: { message?: string };
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
}

export interface ListInstagramMediaResult {
  items: InstagramMedia[];
  nextCursor?: string;
}

export interface PublishInstagramReelInput {
  filePath: string;
  fileSizeBytes: number;
  caption: string;
}

/**
 * Instagram integration via "Instagram API with Instagram Login" — Meta's current
 * (2024+) product for connecting a professional Instagram account directly, without
 * requiring a linked Facebook Page. This is deliberately NOT built on top of
 * FacebookProvider/graph.facebook.com: it's a separate OAuth authorization server
 * (api.instagram.com) and a separate API host (graph.instagram.com), even though both
 * live under the same Meta app (META_APP_ID/META_APP_SECRET) as Facebook Login.
 *
 * Implements SocialProvider for its OAuth lifecycle so it plugs into the same
 * ProviderRegistry/OAuthStateService/TokenRefreshService every other integration uses.
 * publish()/listPosts() are NOT meaningful here (this provider's real methods —
 * publishReel/listMedia — need a caption-shaped input and a container-polling flow
 * PublishInput/listPosts() have no room for) and are never called for INSTAGRAM — the
 * only two call sites in the codebase hardcode Platform.YOUTUBE.
 */
@Injectable()
export class InstagramProvider implements SocialProvider {
  readonly platform = Platform.INSTAGRAM;
  readonly scopes = ['instagram_business_basic', 'instagram_business_content_publish'];

  private readonly logger = new Logger(InstagramProvider.name);
  private readonly appId?: string;
  private readonly appSecret?: string;
  private readonly redirectUri?: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('META_APP_ID') || undefined;
    this.appSecret = this.configService.get<string>('META_APP_SECRET') || undefined;
    this.redirectUri = this.configService.get<string>('INSTAGRAM_REDIRECT_URI') || undefined;
  }

  private requireConfig(): { appId: string; appSecret: string; redirectUri: string } {
    if (!this.appId || !this.appSecret || !this.redirectUri) {
      throw new IntegrationNotConfiguredError(
        'Instagram is not configured yet — set META_APP_ID, META_APP_SECRET and INSTAGRAM_REDIRECT_URI in apps/api/.env',
      );
    }
    return { appId: this.appId, appSecret: this.appSecret, redirectUri: this.redirectUri };
  }

  buildAuthUrl(state: string): string {
    const { appId, redirectUri } = this.requireConfig();
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(','),
      state,
    });
    return `${IG_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Two calls: code -> short-lived token (api.instagram.com, ~1 hour), then short-lived
   * -> long-lived token (graph.instagram.com, ~60 days). Unlike Google/LinkedIn,
   * neither response echoes the granted scope, and there's no confirmed Instagram
   * equivalent of Facebook's /me/permissions — the consent screen for these two bundled
   * permissions doesn't offer a partial-grant option, so a successful code exchange is
   * treated as proof both were granted.
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const { appId, appSecret, redirectUri } = this.requireConfig();

    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    const shortLivedResponse = await fetch(IG_CODE_TOKEN_URL, { method: 'POST', body });
    const shortLived = (await shortLivedResponse.json()) as InstagramShortLivedTokenResponse;

    if (!shortLivedResponse.ok || !shortLived.access_token) {
      this.logger.warn(`Token exchange failed: ${shortLived.error_type} ${shortLived.error_message ?? ''}`);
      throw new OAuthExchangeError(shortLived.error_message ?? 'Failed to exchange authorization code');
    }

    const longLivedParams = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortLived.access_token,
    });
    const longLivedResponse = await fetch(`${IG_GRAPH_URL}/access_token?${longLivedParams}`);
    const longLived = (await longLivedResponse.json()) as InstagramLongLivedTokenResponse;

    if (!longLivedResponse.ok || !longLived.access_token) {
      throw new OAuthExchangeError('Failed to obtain a long-lived Instagram access token');
    }

    return {
      accessToken: longLived.access_token,
      expiresAt: new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 60 * 60) * 1000),
      scope: this.scopes.join(' '),
    };
  }

  async fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount> {
    const response = await fetch(
      `${IG_GRAPH_URL}/me?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(tokens.accessToken)}`,
    );
    const data = (await response.json()) as InstagramMeResponse;

    if (!response.ok || data.error) {
      throw new OAuthExchangeError(data.error?.message ?? 'Failed to fetch Instagram account information');
    }
    if (!data.id) {
      throw new NoInstagramAccountError('Instagram did not return an account to connect');
    }

    return {
      platformUserId: data.id,
      displayName: data.name || data.username,
      avatarUrl: data.profile_picture_url,
    };
  }

  /**
   * Instagram does have a real refresh mechanism (GET graph.instagram.com/refresh_access_token
   * with the CURRENT token, returning a new 60-day token) — but it takes the access
   * token itself as input and returns a replacement for it, not a separate stable
   * refresh token. TokenRefreshService's contract only ever persists the refreshed
   * accessToken/expiresAt, never a rotated refresh token (see its comment), so wiring
   * this up would silently start refreshing against an increasingly stale token after
   * the first cycle. Deliberately not populating OAuthTokens.refreshToken instead —
   * same "reconnect after ~60 days" tradeoff as FacebookProvider and LinkedInProvider.
   */
  async refresh(): Promise<OAuthTokens> {
    throw new TokenRefreshError('Instagram access tokens cannot be refreshed here — reconnect instead');
  }

  /**
   * Instagram's own API (graph.instagram.com) exposes no token-revoke endpoint —
   * documented no-op, same situation as LinkedIn. Disconnecting removes our stored
   * copy; the user can revoke CrossPost AI's access from Instagram's own
   * Settings -> Apps and Websites if they want to fully sever it on Instagram's side.
   */
  async revoke(_token: string): Promise<void> {
    this.logger.log('Instagram has no public token-revoke endpoint — local disconnect only.');
  }

  /**
   * Publishes a Reel via the resumable-upload Content Publishing flow: create a
   * container, stream the video bytes to it, poll until Instagram finishes processing,
   * then publish the container. Streamed from disk (not buffered into memory), mirroring
   * YouTubeProvider's resumable-upload style.
   */
  async publishReel(accessToken: string, igUserId: string, input: PublishInstagramReelInput): Promise<PublishResult> {
    const containerId = await this.createReelContainer(accessToken, igUserId, input.caption);
    await this.uploadVideoBytes(accessToken, containerId, input);
    await this.waitUntilFinished(accessToken, containerId);
    return this.publishContainer(accessToken, igUserId, containerId);
  }

  private async createReelContainer(accessToken: string, igUserId: string, caption: string): Promise<string> {
    const response = await fetch(`${IG_GRAPH_URL}/${encodeURIComponent(igUserId)}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        upload_type: 'resumable',
        caption,
        access_token: accessToken,
      }),
    });
    const data = (await response.json()) as InstagramMediaContainer;

    if (!response.ok || !data.id) {
      this.throwForApiError(response.status, data.error, 'Failed to create the Instagram media container');
    }
    return data.id as string;
  }

  private async uploadVideoBytes(
    accessToken: string,
    containerId: string,
    input: PublishInstagramReelInput,
  ): Promise<void> {
    const stream = createReadStream(input.filePath);
    let response: Response;
    try {
      response = await fetch(`${IG_RUPLOAD_URL}/${encodeURIComponent(containerId)}`, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${accessToken}`,
          offset: '0',
          file_size: String(input.fileSizeBytes),
        },
        body: stream as unknown as BodyInit,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
    } catch (err) {
      throw new FileUploadError(`Network error while uploading to Instagram: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new FileUploadError(body?.error_message ?? 'Instagram rejected the uploaded video');
    }
  }

  private async waitUntilFinished(accessToken: string, containerId: string): Promise<void> {
    for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));

      const response = await fetch(
        `${IG_GRAPH_URL}/${encodeURIComponent(containerId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
      );
      const data = (await response.json()) as InstagramContainerStatus;

      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        throw new FileUploadError(data.error?.message ?? 'Instagram failed to process the uploaded video');
      }
      // IN_PROGRESS (or PUBLISHED, which shouldn't happen pre-publish) -> keep polling.
    }
    throw new FileUploadError('Timed out waiting for Instagram to finish processing the video');
  }

  private async publishContainer(accessToken: string, igUserId: string, containerId: string): Promise<PublishResult> {
    const response = await fetch(`${IG_GRAPH_URL}/${encodeURIComponent(igUserId)}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    });
    const data = (await response.json()) as { id?: string; error?: { message?: string; code?: number } };

    if (!response.ok || !data.id) {
      this.throwForApiError(response.status, data.error, 'Instagram did not return a media id after publishing');
    }
    return { platformPostId: data.id as string };
  }

  /** Lists media already on the account, newest first. */
  async listMedia(
    accessToken: string,
    igUserId: string,
    opts: { after?: string; limit?: number },
  ): Promise<ListInstagramMediaResult> {
    const params = new URLSearchParams({
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
      access_token: accessToken,
      limit: String(Math.min(Math.max(opts.limit ?? 24, 1), 50)),
    });
    if (opts.after) params.set('after', opts.after);

    const response = await fetch(`${IG_GRAPH_URL}/${encodeURIComponent(igUserId)}/media?${params}`);
    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        timestamp?: string;
      }>;
      paging?: { cursors?: { after?: string }; next?: string };
      error?: { message?: string; code?: number };
    };

    if (!response.ok || data.error) {
      this.throwForApiError(response.status, data.error, 'Failed to list Instagram media');
    }

    const items: InstagramMedia[] = (data.data ?? []).map((m) => ({
      id: m.id,
      caption: m.caption,
      mediaType: m.media_type,
      mediaUrl: m.media_url,
      thumbnailUrl: m.thumbnail_url,
      permalink: m.permalink,
      timestamp: m.timestamp,
    }));

    return { items, nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined };
  }

  private throwForApiError(status: number, error: { message?: string; code?: number } | undefined, fallback: string): never {
    const message = error?.message ?? fallback;
    this.logger.warn(`Instagram API error (${status}, code=${error?.code}): ${message}`);

    if (status === 401 || error?.code === 190) {
      throw new TokenRefreshError('The access token was rejected by Instagram');
    }
    if (status === 403) {
      throw new InsufficientScopeError(message);
    }
    if (status === 429 || error?.code === 4 || error?.code === 32) {
      throw new QuotaExceededError(message);
    }
    throw new FileUploadError(message);
  }

  // --- SocialProvider methods that don't apply to Instagram's container-based publish flow ---
  // Never invoked: the only callers of ProviderRegistry.get(...).publish()/.listPosts()
  // in this codebase hardcode Platform.YOUTUBE (see publishing.service.ts, videos.service.ts).

  async publish(): Promise<PublishResult> {
    throw new FileUploadError('Use publishReel for Instagram, not publish');
  }

  async listPosts(): Promise<ListPostsResult> {
    throw new FileUploadError('Use listMedia for Instagram, not listPosts');
  }
}
