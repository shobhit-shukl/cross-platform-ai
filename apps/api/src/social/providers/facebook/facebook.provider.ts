import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
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
  NoFacebookPageError,
  OAuthExchangeError,
  QuotaExceededError,
  TokenRefreshError,
} from '../../social.errors';

const GRAPH_API_VERSION = 'v21.0'; // Bump periodically — Meta deprecates versions ~2 years after release.
const FACEBOOK_AUTH_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const GRAPH_VIDEO_URL = `https://graph-video.facebook.com/${GRAPH_API_VERSION}`;

interface FacebookTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; type?: string; code?: number };
}

interface FacebookPermissionsResponse {
  data?: Array<{ permission: string; status: 'granted' | 'declined' }>;
  error?: { message?: string };
}

interface FacebookPage {
  id: string;
  name?: string;
  access_token?: string;
  picture?: { data?: { url?: string } };
}

interface FacebookAccountsResponse {
  data?: FacebookPage[];
  error?: { message?: string; code?: number };
}

export interface FacebookVideo {
  id: string;
  description?: string;
  permalinkUrl?: string;
  pictureUrl?: string;
  createdTime?: string;
  lengthSeconds?: number;
}

export interface ListFacebookVideosResult {
  items: FacebookVideo[];
  nextCursor?: string;
}

export interface PublishFacebookVideoInput {
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  caption: string;
}

/**
 * Facebook Page integration via the Meta Graph API. Implements SocialProvider for its
 * OAuth lifecycle (buildAuthUrl/exchangeCode/fetchAccount/refresh/revoke) so it plugs
 * into the same ProviderRegistry, OAuthStateService, and TokenRefreshService the other
 * integrations use — no changes needed to any of that generic infrastructure.
 *
 * Unlike Google/LinkedIn, the token this class stores in SocialAccount.accessToken is
 * the long-lived USER token, not a Page access token — a Page token by itself doesn't
 * identify which page it belongs to, and Meta doesn't return one on every /me/accounts
 * call in a shape the generic OAuth callback (buildAuthUrl -> exchangeCode ->
 * fetchAccount -> upsertConnection) can thread through. Instead, getPageAccessToken()
 * re-derives the current Page token from the stored user token right before each
 * publish/list call — see FacebookService.
 *
 * publish()/listPosts() are NOT meaningful here (this provider's real methods —
 * getPageAccessToken/publishVideo/listVideos — take a Page id and Page token, which
 * PublishInput/the generic listPosts() signature have no room for) and are never
 * called for FACEBOOK — the only two call sites in the codebase hardcode
 * Platform.YOUTUBE. They exist purely so this class satisfies the shared interface.
 */
@Injectable()
export class FacebookProvider implements SocialProvider {
  readonly platform = Platform.FACEBOOK;
  // Least-privilege for "list my Pages + post a video to one": no ads, no messaging,
  // no full page management.
  readonly scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'public_profile'];

  private readonly logger = new Logger(FacebookProvider.name);
  private readonly appId?: string;
  private readonly appSecret?: string;
  private readonly redirectUri?: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('META_APP_ID') || undefined;
    this.appSecret = this.configService.get<string>('META_APP_SECRET') || undefined;
    this.redirectUri = this.configService.get<string>('FACEBOOK_REDIRECT_URI') || undefined;
  }

  /** Throws a specific, actionable error rather than sending a doomed request with an empty client_id. */
  private requireConfig(): { appId: string; appSecret: string; redirectUri: string } {
    if (!this.appId || !this.appSecret || !this.redirectUri) {
      throw new IntegrationNotConfiguredError(
        'Facebook is not configured yet — set META_APP_ID, META_APP_SECRET and FACEBOOK_REDIRECT_URI in apps/api/.env',
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
    return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Three Graph API calls in sequence: (1) exchange the code for a short-lived user
   * token, (2) exchange that for a long-lived (~60 day) user token — Facebook has no
   * refresh_token grant, so this is the only extension mechanism it offers, and (3)
   * read back the permissions actually granted, since (unlike Google/LinkedIn) neither
   * token endpoint echoes `scope` in its response — the OAuth callback still needs it
   * to enforce InsufficientScopeError the same way every other provider does.
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const { appId, appSecret, redirectUri } = this.requireConfig();

    const shortLived = await this.getJson<FacebookTokenResponse>(
      `${GRAPH_URL}/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      })}`,
    );
    if (!shortLived.access_token) {
      this.logger.warn(`Token exchange failed: ${shortLived.error?.message}`);
      throw new OAuthExchangeError(shortLived.error?.message ?? 'Failed to exchange authorization code');
    }

    const longLived = await this.getJson<FacebookTokenResponse>(
      `${GRAPH_URL}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLived.access_token,
      })}`,
    );
    if (!longLived.access_token) {
      this.logger.warn(`Long-lived token exchange failed: ${longLived.error?.message}`);
      throw new OAuthExchangeError(longLived.error?.message ?? 'Failed to obtain a long-lived access token');
    }

    const scope = await this.fetchGrantedScope(longLived.access_token);

    return {
      accessToken: longLived.access_token,
      // Facebook returns no refresh_token; expires_in is ~5,184,000s (60 days) for the
      // long-lived token. Fall back to 60 days if Facebook ever omits it.
      expiresAt: new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 60 * 60) * 1000),
      scope,
    };
  }

  private async fetchGrantedScope(accessToken: string): Promise<string> {
    const data = await this.getJson<FacebookPermissionsResponse>(
      `${GRAPH_URL}/me/permissions?access_token=${encodeURIComponent(accessToken)}`,
    );
    return (data.data ?? [])
      .filter((p) => p.status === 'granted')
      .map((p) => p.permission)
      .join(' ');
  }

  /** Picks the first Page the user administers — same "pick the first one" convention as YouTube's channel lookup. */
  async fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount> {
    const data = await this.getJson<FacebookAccountsResponse>(
      `${GRAPH_URL}/me/accounts?fields=id,name,picture&access_token=${encodeURIComponent(tokens.accessToken)}`,
    );
    if (data.error) {
      throw new OAuthExchangeError(data.error.message ?? 'Failed to fetch Facebook Page information');
    }

    const page = data.data?.[0];
    if (!page) {
      throw new NoFacebookPageError();
    }

    return {
      platformUserId: page.id,
      displayName: page.name,
      avatarUrl: page.picture?.data?.url,
    };
  }

  /**
   * Never actually invoked: exchangeCode never populates OAuthTokens.refreshToken (see
   * its comment above), and TokenRefreshService only calls provider.refresh() when a
   * refresh token was stored — it marks needsReauth straight away otherwise. Kept for
   * interface completeness, exactly like LinkedInProvider.refresh() when the
   * Programmatic Refresh Tokens product isn't enabled.
   */
  async refresh(): Promise<OAuthTokens> {
    throw new TokenRefreshError('Facebook access tokens cannot be refreshed — reconnect instead');
  }

  /** Revokes every permission this app was granted, unlike LinkedIn (no public revoke endpoint at all). */
  async revoke(token: string): Promise<void> {
    try {
      await fetch(`${GRAPH_URL}/me/permissions?access_token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      this.logger.warn(`Failed to revoke Facebook permissions: ${(err as Error).message}`);
    }
  }

  /**
   * Re-derives the Page access token for `pageId` from the stored long-lived user
   * token. Page tokens obtained this way don't carry their own separate expiry while
   * the user token and the page-management permission remain valid, so nothing needs
   * to be cached — this is cheap enough to call before every publish/list action.
   */
  async getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
    const data = await this.getJson<FacebookAccountsResponse>(
      `${GRAPH_URL}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userAccessToken)}`,
    );
    if (data.error) {
      this.throwForApiError(data.error);
    }

    const page = data.data?.find((p) => p.id === pageId);
    if (!page?.access_token) {
      throw new NoFacebookPageError('That Facebook Page is no longer accessible — reconnect Facebook');
    }
    return page.access_token;
  }

  /**
   * Uploads a video to the Page's feed via Facebook's simple (non-resumable) upload
   * endpoint — appropriate up to the app's own 500MB cap; a true chunked/resumable
   * upload would be the production-grade choice for larger files, matching the same
   * "sufficient for this milestone" tradeoff YouTubeProvider's single-PUT upload makes.
   * The body is streamed from disk (not buffered into memory) so this scales to that
   * cap without loading the whole file at once.
   */
  async publishVideo(
    pageAccessToken: string,
    pageId: string,
    input: PublishFacebookVideoInput,
  ): Promise<PublishResult> {
    const boundary = `crosspost-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fields = { access_token: pageAccessToken, description: input.caption };

    const preamble = Buffer.concat(
      Object.entries(fields).map(([key, value]) =>
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`, 'utf8'),
      ),
    );
    const filePartHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="video"\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
      'utf8',
    );
    const closing = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const contentLength = preamble.length + filePartHeader.length + input.fileSizeBytes + closing.length;

    async function* body() {
      yield preamble;
      yield filePartHeader;
      for await (const chunk of createReadStream(input.filePath)) {
        yield chunk;
      }
      yield closing;
    }

    const response = await fetch(`${GRAPH_VIDEO_URL}/${encodeURIComponent(pageId)}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(contentLength),
      },
      body: Readable.from(body()) as unknown as BodyInit,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Facebook rejected the uploaded video');
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      throw new FileUploadError('Facebook did not return a video id after upload');
    }
    return { platformPostId: data.id };
  }

  /** Lists videos already on the Page, newest first. */
  async listVideos(
    pageAccessToken: string,
    pageId: string,
    opts: { after?: string; limit?: number },
  ): Promise<ListFacebookVideosResult> {
    const params = new URLSearchParams({
      fields: 'id,description,permalink_url,picture,created_time,length',
      access_token: pageAccessToken,
      limit: String(Math.min(Math.max(opts.limit ?? 24, 1), 50)),
    });
    if (opts.after) params.set('after', opts.after);

    const response = await fetch(`${GRAPH_URL}/${encodeURIComponent(pageId)}/videos?${params}`);
    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to list Facebook videos');
    }

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        description?: string;
        permalink_url?: string;
        picture?: string;
        created_time?: string;
        length?: number;
      }>;
      paging?: { cursors?: { after?: string }; next?: string };
    };

    const items: FacebookVideo[] = (data.data ?? []).map((v) => ({
      id: v.id,
      description: v.description,
      permalinkUrl: v.permalink_url ? `https://www.facebook.com${v.permalink_url}` : undefined,
      pictureUrl: v.picture,
      createdTime: v.created_time,
      lengthSeconds: v.length,
    }));

    return { items, nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined };
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    return (await response.json()) as T;
  }

  private throwForApiError(error: { message?: string; code?: number }): never {
    this.logger.warn(`Facebook API error (code=${error.code}): ${error.message}`);
    // 190 = access token invalid/expired; 200s generally mean a missing permission.
    if (error.code === 190) {
      throw new TokenRefreshError('The access token was rejected by Facebook');
    }
    if (error.code && error.code >= 200 && error.code < 300) {
      throw new InsufficientScopeError(error.message);
    }
    throw new FileUploadError(error.message ?? 'Facebook returned an error');
  }

  private async throwForFailedResponse(response: Response, fallbackMessage: string): Promise<never> {
    const body = await response.json().catch(() => null);
    const error: { message?: string; code?: number } = body?.error ?? {};
    const message = error.message ?? fallbackMessage;

    this.logger.warn(`Facebook API error (${response.status}, code=${error.code}): ${message}`);

    if (response.status === 401 || error.code === 190) {
      throw new TokenRefreshError('The access token was rejected by Facebook');
    }
    if (response.status === 403) {
      throw new InsufficientScopeError(message);
    }
    if (response.status === 429 || error.code === 32 || error.code === 4) {
      throw new QuotaExceededError(message);
    }
    throw new FileUploadError(message);
  }

  // --- SocialProvider methods that don't apply to Facebook's page-token model ---
  // Never invoked: the only callers of ProviderRegistry.get(...).publish()/.listPosts()
  // in this codebase hardcode Platform.YOUTUBE (see publishing.service.ts, videos.service.ts).

  async publish(): Promise<PublishResult> {
    throw new FileUploadError('Use publishVideo for Facebook, not publish');
  }

  async listPosts(): Promise<ListPostsResult> {
    throw new FileUploadError('Use listVideos for Facebook, not listPosts');
  }
}
