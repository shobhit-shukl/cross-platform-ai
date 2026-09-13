import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Platform, SocialAccount } from '@prisma/client';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRefreshService } from './token-refresh.service';
import { InstagramProvider, ListInstagramMediaResult } from './providers/instagram/instagram.provider';
import { PublishInstagramReelDto } from './dto/publish-instagram-reel.dto';
import { validateVideoFile } from './video-file-validator';
import {
  FileUploadError,
  InsufficientScopeError,
  IntegrationNotConfiguredError,
  QuotaExceededError,
  TokenRefreshError,
} from './social.errors';

/** Same shape as FacebookApiError/LinkedInApiError elsewhere. */
class InstagramApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

interface UploadedFile {
  path: string;
  size: number;
}

// Instagram only accepts MP4/MOV for Reels (no WebM/AVI), unlike the broader set
// video-file-validator.ts sniffs for YouTube/Facebook.
const SUPPORTED_MIME_TYPES = new Set(['video/mp4', 'video/quicktime']);

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly instagramProvider: InstagramProvider,
  ) {}

  async publishReel(userId: string, dto: PublishInstagramReelDto, file: UploadedFile): Promise<{ platformPostId: string }> {
    try {
      const validation = await validateVideoFile(file.path, file.size);
      if (!validation.ok) {
        throw new InstagramApiError(HttpStatus.BAD_REQUEST, 'invalid_video', validation.reason);
      }
      if (!SUPPORTED_MIME_TYPES.has(validation.mimeType)) {
        throw new InstagramApiError(
          HttpStatus.BAD_REQUEST,
          'invalid_video',
          'Instagram Reels only accept MP4 or MOV video files',
        );
      }

      const { account, accessToken } = await this.resolveAccessToken(userId);
      try {
        return await this.instagramProvider.publishReel(accessToken, account.platformUserId, {
          filePath: file.path,
          fileSizeBytes: file.size,
          caption: dto.caption,
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

  async listMedia(userId: string, opts: { after?: string; limit?: number }): Promise<ListInstagramMediaResult> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      return await this.instagramProvider.listMedia(accessToken, account.platformUserId, opts);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'list_failed');
    }
  }

  private async resolveAccessToken(userId: string): Promise<{ account: SocialAccount; accessToken: string }> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.INSTAGRAM },
    });
    if (!account) {
      throw new InstagramApiError(HttpStatus.NOT_FOUND, 'no_account_connected', 'No Instagram account is connected');
    }
    if (account.needsReauth) {
      throw new InstagramApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Instagram to continue');
    }

    try {
      const accessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
      return { account, accessToken };
    } catch {
      throw new InstagramApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Instagram — the stored credentials are no longer valid',
      );
    }
  }

  /** Mirrors FacebookService/LinkedInService's exact branching — see those files for the reasoning. */
  private async toApiError(err: unknown, socialAccountId: string, fallbackErrorCode: string): Promise<InstagramApiError> {
    if (err instanceof InstagramApiError) return err;
    if (err instanceof IntegrationNotConfiguredError) {
      return new InstagramApiError(HttpStatus.SERVICE_UNAVAILABLE, 'not_configured', err.message);
    }
    if (err instanceof QuotaExceededError) {
      return new InstagramApiError(HttpStatus.TOO_MANY_REQUESTS, 'quota_exceeded', 'Instagram rate limit reached, try again shortly');
    }
    if (err instanceof InsufficientScopeError) {
      await this.prisma.socialAccount.update({ where: { id: socialAccountId }, data: { needsReauth: true } });
      return new InstagramApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Instagram to continue');
    }
    if (err instanceof TokenRefreshError) {
      return new InstagramApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Instagram — the stored credentials are no longer valid',
      );
    }
    if (err instanceof FileUploadError) {
      return new InstagramApiError(HttpStatus.BAD_GATEWAY, fallbackErrorCode, err.message);
    }
    this.logger.error('Unexpected error calling Instagram', err as Error);
    return new InstagramApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'A network error occurred while contacting Instagram. Please try again.',
    );
  }
}
