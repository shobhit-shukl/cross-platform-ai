import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { createReadStream } from 'fs';
import {
  ExternalAccount,
  OAuthTokens,
  PublishInput,
  PublishResult,
  SocialProvider,
} from '../social-provider.interface';
import {
  NoChannelError,
  OAuthExchangeError,
  QuotaExceededError,
  InsufficientScopeError,
  TokenRefreshError,
  VideoUploadError,
} from '../../social.errors';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface YouTubeChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      thumbnails?: { default?: { url?: string } };
    };
  }>;
}

@Injectable()
export class YouTubeProvider implements SocialProvider {
  readonly platform = Platform.YOUTUBE;
  readonly scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
  ];

  private readonly logger = new Logger(YouTubeProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')!;
    this.redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI')!;
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: this.scopes.join(' '),
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !data.access_token) {
      this.logger.warn(`Token exchange failed: ${data.error} ${data.error_description ?? ''}`);
      throw new OAuthExchangeError(data.error_description ?? 'Failed to exchange authorization code');
    }

    return this.toOAuthTokens(data);
  }

  async fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount> {
    const response = await fetch(
      `${YOUTUBE_CHANNELS_URL}?part=snippet&mine=true`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );

    if (!response.ok) {
      throw new OAuthExchangeError('Failed to fetch YouTube channel information');
    }

    const data = (await response.json()) as YouTubeChannelsResponse;
    const channel = data.items?.[0];

    if (!channel) {
      throw new NoChannelError();
    }

    return {
      platformUserId: channel.id,
      displayName: channel.snippet?.title,
      avatarUrl: channel.snippet?.thumbnails?.default?.url,
    };
  }

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !data.access_token) {
      this.logger.warn(`Token refresh failed: ${data.error} ${data.error_description ?? ''}`);
      throw new TokenRefreshError(data.error_description);
    }

    // Google does not re-issue a refresh_token on refresh; caller must keep the original.
    return this.toOAuthTokens(data);
  }

  async revoke(token: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      // Best-effort: Google's revoke endpoint being unreachable shouldn't block a local disconnect.
      this.logger.warn(`Failed to revoke token with Google: ${(err as Error).message}`);
    }
  }

  /**
   * Uploads a video via YouTube's resumable upload protocol:
   *  1. POST the metadata to get a resumable session URI (in the `Location` header).
   *  2. PUT the video bytes, streamed from disk, to that session URI.
   * This does a single-shot PUT of the whole stream rather than implementing
   * chunk-level resume-on-failure — sufficient for this milestone; a dropped upload
   * is reported as a failure rather than resumed from a partial chunk.
   */
  async publish(accessToken: string, input: PublishInput): Promise<PublishResult> {
    const sessionUri = await this.initiateResumableUpload(accessToken, input);
    return this.putVideoBytes(sessionUri, accessToken, input);
  }

  private async initiateResumableUpload(accessToken: string, input: PublishInput): Promise<string> {
    const response = await fetch(`${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        'X-Upload-Content-Length': String(input.fileSizeBytes),
      },
      body: JSON.stringify({
        snippet: { title: input.title, description: input.description ?? '' },
        status: { privacyStatus: input.privacyStatus },
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to initiate the YouTube upload session');
    }

    const sessionUri = response.headers.get('location');
    if (!sessionUri) {
      throw new VideoUploadError('YouTube did not return an upload session URI');
    }
    return sessionUri;
  }

  private async putVideoBytes(
    sessionUri: string,
    accessToken: string,
    input: PublishInput,
  ): Promise<PublishResult> {
    const stream = createReadStream(input.filePath);

    let response: Response;
    try {
      response = await fetch(sessionUri, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': input.mimeType,
          'Content-Length': String(input.fileSizeBytes),
        },
        // Node's fetch requires `duplex: 'half'` when the body is a stream.
        body: stream as unknown as BodyInit,
        duplex: 'half',
        signal: input.signal,
      } as RequestInit & { duplex: 'half' });
    } catch (err) {
      // Preserve AbortError's identity so the caller can tell "user cancelled" apart
      // from a genuine network failure.
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      throw new VideoUploadError(`Network error while uploading to YouTube: ${(err as Error).message}`);
    }

    if (!response.ok) {
      await this.throwForFailedResponse(response, 'YouTube rejected the uploaded video');
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      throw new VideoUploadError('YouTube did not return a video id after upload');
    }
    return { platformPostId: data.id };
  }

  /** Maps Google's error payload to a specific, catchable error type. */
  private async throwForFailedResponse(response: Response, fallbackMessage: string): Promise<never> {
    const body = await response.json().catch(() => null);
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    const message: string = body?.error?.message ?? fallbackMessage;

    this.logger.warn(`YouTube API error (${response.status}, reason=${reason}): ${message}`);

    if (response.status === 401) {
      throw new TokenRefreshError('The access token was rejected by YouTube');
    }
    if (response.status === 403) {
      if (reason === 'quotaExceeded' || reason === 'uploadLimitExceeded' || reason === 'dailyLimitExceeded') {
        throw new QuotaExceededError(message);
      }
      throw new InsufficientScopeError(message);
    }
    throw new VideoUploadError(message);
  }

  private toOAuthTokens(data: GoogleTokenResponse): OAuthTokens {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }
}
