import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Platform, SocialAccount } from '@prisma/client';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRefreshService } from './token-refresh.service';
import {
  DriveUploadResult,
  GoogleDriveProvider,
  ListDriveFilesResult,
} from './providers/google-drive/google-drive.provider';
import { FileUploadError, InsufficientScopeError, QuotaExceededError, TokenRefreshError } from './social.errors';

/** Same shape as VideosApiError in videos.service.ts — stable errorCode alongside the HTTP status. */
class DriveApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

interface UploadedFile {
  path: string;
  size: number;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class DriveUploadService {
  private readonly logger = new Logger(DriveUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly googleDriveProvider: GoogleDriveProvider,
  ) {}

  /** Uploads a file (e.g. AI-generated output) to the user's connected Google Drive. */
  async uploadFile(userId: string, file: UploadedFile, fileName?: string): Promise<DriveUploadResult> {
    try {
      const { account, accessToken } = await this.resolveAccessToken(userId);
      try {
        return await this.googleDriveProvider.uploadFile(accessToken, {
          filePath: file.path,
          fileName: fileName ?? file.originalname,
          mimeType: file.mimetype || 'application/octet-stream',
        });
      } catch (err) {
        throw await this.toApiError(err, account.id, 'upload_failed');
      }
    } finally {
      await unlink(file.path).catch(() => {
        // Best-effort cleanup — a leftover temp file isn't worth failing the request over.
      });
    }
  }

  async listFiles(userId: string, opts: { pageToken?: string; limit?: number }): Promise<ListDriveFilesResult> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      return await this.googleDriveProvider.listFiles(accessToken, opts);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'list_failed');
    }
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      await this.googleDriveProvider.deleteFile(accessToken, fileId);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'delete_failed');
    }
  }

  /** Shared by upload/list/delete: find the connected Drive account and a usable access token. */
  private async resolveAccessToken(userId: string): Promise<{ account: SocialAccount; accessToken: string }> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.GOOGLE_DRIVE },
    });

    if (!account) {
      throw new DriveApiError(HttpStatus.NOT_FOUND, 'no_account_connected', 'No Google Drive account is connected');
    }
    if (account.needsReauth) {
      throw new DriveApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Google Drive to continue');
    }

    try {
      const accessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
      return { account, accessToken };
    } catch {
      throw new DriveApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Google Drive — the stored credentials are no longer valid',
      );
    }
  }

  /**
   * Mirrors PublishingService.failFromError's exact branching for the YouTube upload
   * path: InsufficientScopeError means the token fundamentally lacks the right grant,
   * so the account is flagged needsReauth so the dashboard proactively shows
   * "Reconnect" rather than the user hitting the same error again next time. A plain
   * TokenRefreshError from this call (as opposed to from the scheduled refresh in
   * TokenRefreshService, which already flags it) is reported but not flagged — matches
   * publishing.service.ts's existing precedent, not a Drive-specific choice.
   */
  private async toApiError(err: unknown, socialAccountId: string, fallbackErrorCode: string): Promise<DriveApiError> {
    if (err instanceof DriveApiError) return err;
    if (err instanceof QuotaExceededError) {
      return new DriveApiError(HttpStatus.TOO_MANY_REQUESTS, 'quota_exceeded', 'Google Drive storage quota reached');
    }
    if (err instanceof InsufficientScopeError) {
      await this.prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: { needsReauth: true },
      });
      return new DriveApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Google Drive to continue');
    }
    if (err instanceof TokenRefreshError) {
      return new DriveApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Google Drive — the stored credentials are no longer valid',
      );
    }
    if (err instanceof FileUploadError) {
      return new DriveApiError(HttpStatus.BAD_GATEWAY, fallbackErrorCode, err.message);
    }
    this.logger.error('Unexpected error calling Google Drive', err as Error);
    return new DriveApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'A network error occurred while contacting Google Drive. Please try again.',
    );
  }
}
