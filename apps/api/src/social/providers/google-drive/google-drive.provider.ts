import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { readFile } from 'fs/promises';
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
  OAuthExchangeError,
  QuotaExceededError,
  TokenRefreshError,
} from '../../social.errors';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const DRIVE_ABOUT_URL = 'https://www.googleapis.com/drive/v3/about';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100; // Drive's own ceiling for files.list

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface DriveAboutResponse {
  user?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
    permissionId?: string;
  };
}

interface DriveFilesCreateResponse {
  id?: string;
  name?: string;
  webViewLink?: string;
}

interface DriveFileResource {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

interface DriveFilesListResponse {
  files?: DriveFileResource[];
  nextPageToken?: string;
}

export interface DriveUploadInput {
  filePath: string;
  fileName: string;
  mimeType: string;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
}

export interface DriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

export interface ListDriveFilesResult {
  items: DriveFile[];
  nextPageToken?: string;
}

/**
 * Google Drive integration. Implements SocialProvider for its OAuth lifecycle
 * (buildAuthUrl/exchangeCode/fetchAccount/refresh/revoke) so it plugs into the same
 * ProviderRegistry, OAuthStateService, and TokenRefreshService the YouTube integration
 * already uses — none of that generic infrastructure needed to change.
 *
 * publish()/listPosts() are NOT meaningful for a file-storage provider (there is no
 * "post" to publish or list) and are never called for GOOGLE_DRIVE — the only two
 * call sites in the codebase hardcode Platform.YOUTUBE. They exist purely so this class
 * satisfies the shared interface; each throws immediately if that ever changes.
 */
@Injectable()
export class GoogleDriveProvider implements SocialProvider {
  readonly platform = Platform.GOOGLE_DRIVE;
  // Deliberately minimal: drive.file only grants access to files this app itself
  // creates (or files the user explicitly picks via a picker, which we don't use) —
  // never the user's whole Drive. This is the scope requested in Cloud Console; do
  // not broaden it to `.../auth/drive` without the user's explicit say-so.
  readonly scopes = ['https://www.googleapis.com/auth/drive.file'];

  private readonly logger = new Logger(GoogleDriveProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')!;
    this.redirectUri = this.configService.get<string>('GOOGLE_DRIVE_REDIRECT_URI')!;
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      // Deliberately omitted: include_granted_scopes=true — see the identical note in
      // YouTubeProvider.buildAuthUrl. Without it, connecting Drive requests only
      // drive.file, independent of whatever YouTube scopes this Google account may
      // already have granted the same client.
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

  /**
   * Drive's `about.get` doubles as "who am I" — it works with any drive.* scope,
   * including drive.file, so this doesn't need a separate profile/userinfo scope.
   */
  async fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount> {
    const response = await fetch(`${DRIVE_ABOUT_URL}?fields=user`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      throw new OAuthExchangeError('Failed to fetch Google Drive account information');
    }

    const data = (await response.json()) as DriveAboutResponse;
    const user = data.user;

    if (!user) {
      throw new OAuthExchangeError('Google did not return Drive account information');
    }

    return {
      platformUserId: user.permissionId ?? user.emailAddress ?? 'unknown',
      displayName: user.displayName ?? user.emailAddress,
      avatarUrl: user.photoLink,
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

    return this.toOAuthTokens(data);
  }

  async revoke(token: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      this.logger.warn(`Failed to revoke Drive token with Google: ${(err as Error).message}`);
    }
  }

  /**
   * Uploads a file via Drive's multipart upload (metadata + content in one request).
   * Appropriate for the modest file sizes an AI-generation feature produces — Google's
   * resumable protocol (already used for YouTube's much larger video files) would be
   * unnecessary complexity here.
   */
  async uploadFile(accessToken: string, input: DriveUploadInput): Promise<DriveUploadResult> {
    const boundary = `crosspost-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fileBuffer = await readFile(input.filePath);

    const metadata = JSON.stringify({ name: input.fileName });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to upload the file to Google Drive');
    }

    const data = (await response.json()) as DriveFilesCreateResponse;
    if (!data.id || !data.webViewLink) {
      throw new FileUploadError('Google Drive did not return the expected file details');
    }

    return { fileId: data.id, fileName: data.name ?? input.fileName, webViewLink: data.webViewLink };
  }

  /**
   * Lists files, newest-modified first. No `q` filter is needed to scope this to "files
   * this app can see" — with the drive.file scope, Google's files.list already only
   * ever returns files the app itself created (or that the user picked via a Picker,
   * which this app doesn't use), never the rest of the user's Drive.
   */
  async listFiles(
    accessToken: string,
    opts: { pageToken?: string; limit?: number },
  ): Promise<ListDriveFilesResult> {
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const params = new URLSearchParams({
      pageSize: String(limit),
      orderBy: 'modifiedTime desc',
      fields: 'nextPageToken,files(id,name,mimeType,size,webViewLink,iconLink,thumbnailLink,modifiedTime)',
      spaces: 'drive',
    });
    if (opts.pageToken) {
      params.set('pageToken', opts.pageToken);
    }

    const response = await fetch(`${DRIVE_FILES_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to list Google Drive files');
    }

    const data = (await response.json()) as DriveFilesListResponse;
    const items: DriveFile[] = (data.files ?? []).map((f) => ({
      fileId: f.id,
      name: f.name ?? '(untitled)',
      mimeType: f.mimeType ?? 'application/octet-stream',
      sizeBytes: f.size !== undefined ? Number(f.size) : undefined,
      webViewLink: f.webViewLink,
      iconLink: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      modifiedTime: f.modifiedTime,
    }));

    return { items, nextPageToken: data.nextPageToken };
  }

  async deleteFile(accessToken: string, fileId: string): Promise<void> {
    const response = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Google returns 204 on success. A 404 here means the file is already gone (or was
    // never visible under drive.file scope) — treat that as success too, since the end
    // state the caller wants (file not present) is already true.
    if (!response.ok && response.status !== 404) {
      await this.throwForFailedResponse(response, 'Failed to delete the Google Drive file');
    }
  }

  private async throwForFailedResponse(response: Response, fallbackMessage: string): Promise<never> {
    const body = await response.json().catch(() => null);
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    const message: string = body?.error?.message ?? fallbackMessage;

    this.logger.warn(`Drive API error (${response.status}, reason=${reason}): ${message}`);

    if (response.status === 401) {
      throw new TokenRefreshError('The access token was rejected by Google Drive');
    }
    if (response.status === 403) {
      if (reason === 'storageQuotaExceeded' || reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
        throw new QuotaExceededError(message);
      }
      throw new InsufficientScopeError(message);
    }
    throw new FileUploadError(message);
  }

  private toOAuthTokens(data: GoogleTokenResponse): OAuthTokens {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  // --- SocialProvider methods that don't apply to a storage provider ---
  // Never invoked: the only callers of ProviderRegistry.get(...).publish()/.listPosts()
  // in this codebase hardcode Platform.YOUTUBE (see publishing.service.ts, videos.service.ts).

  async publish(): Promise<PublishResult> {
    throw new FileUploadError('Publishing is not supported for Google Drive');
  }

  async listPosts(): Promise<ListPostsResult> {
    throw new FileUploadError('Listing posts is not supported for Google Drive');
  }
}
