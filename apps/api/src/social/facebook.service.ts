import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Platform, SocialAccount } from '@prisma/client';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRefreshService } from './token-refresh.service';
import { FacebookProvider, FacebookVideo, ListFacebookVideosResult } from './providers/facebook/facebook.provider';
import { PublishFacebookVideoDto } from './dto/publish-facebook-video.dto';
import { validateVideoFile } from './video-file-validator';
import {
  FileUploadError,
  InsufficientScopeError,
  IntegrationNotConfiguredError,
  NoFacebookPageError,
  QuotaExceededError,
  TokenRefreshError,
} from './social.errors';

/** Same shape as LinkedInApiError/CalendarApiError/DriveApiError elsewhere. */
class FacebookApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

interface UploadedFile {
  path: string;
  size: number;
}

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly facebookProvider: FacebookProvider,
  ) {}

  async publishVideo(userId: string, dto: PublishFacebookVideoDto, file: UploadedFile): Promise<{ platformPostId: string }> {
    try {
      const validation = await validateVideoFile(file.path, file.size);
      if (!validation.ok) {
        throw new FacebookApiError(HttpStatus.BAD_REQUEST, 'invalid_video', validation.reason);
      }

      const { account, pageAccessToken } = await this.resolvePageAccessToken(userId);
      try {
        return await this.facebookProvider.publishVideo(pageAccessToken, account.platformUserId, {
          filePath: file.path,
          fileSizeBytes: file.size,
          mimeType: validation.mimeType,
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

  async listVideos(userId: string, opts: { after?: string; limit?: number }): Promise<ListFacebookVideosResult> {
    const { account, pageAccessToken } = await this.resolvePageAccessToken(userId);
    try {
      return await this.facebookProvider.listVideos(pageAccessToken, account.platformUserId, opts);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'list_failed');
    }
  }

  /** Shared by publish/list: find the connected Page and re-derive its current Page access token. */
  private async resolvePageAccessToken(
    userId: string,
  ): Promise<{ account: SocialAccount; pageAccessToken: string }> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.FACEBOOK },
    });
    if (!account) {
      throw new FacebookApiError(HttpStatus.NOT_FOUND, 'no_account_connected', 'No Facebook Page is connected');
    }
    if (account.needsReauth) {
      throw new FacebookApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Facebook to continue');
    }

    let userAccessToken: string;
    try {
      userAccessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
    } catch {
      throw new FacebookApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Facebook — the stored credentials are no longer valid',
      );
    }

    try {
      const pageAccessToken = await this.facebookProvider.getPageAccessToken(userAccessToken, account.platformUserId);
      return { account, pageAccessToken };
    } catch (err) {
      throw await this.toApiError(err, account.id, 'reauth_required');
    }
  }

  /** Mirrors LinkedInService/CalendarService/DriveUploadService's exact branching — see those files for the reasoning. */
  private async toApiError(err: unknown, socialAccountId: string, fallbackErrorCode: string): Promise<FacebookApiError> {
    if (err instanceof FacebookApiError) return err;
    if (err instanceof IntegrationNotConfiguredError) {
      return new FacebookApiError(HttpStatus.SERVICE_UNAVAILABLE, 'not_configured', err.message);
    }
    if (err instanceof QuotaExceededError) {
      return new FacebookApiError(HttpStatus.TOO_MANY_REQUESTS, 'quota_exceeded', 'Facebook rate limit reached, try again shortly');
    }
    if (err instanceof NoFacebookPageError) {
      await this.prisma.socialAccount.update({ where: { id: socialAccountId }, data: { needsReauth: true } });
      return new FacebookApiError(HttpStatus.CONFLICT, 'reauth_required', err.message);
    }
    if (err instanceof InsufficientScopeError) {
      await this.prisma.socialAccount.update({ where: { id: socialAccountId }, data: { needsReauth: true } });
      return new FacebookApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Facebook to continue');
    }
    if (err instanceof TokenRefreshError) {
      return new FacebookApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Facebook — the stored credentials are no longer valid',
      );
    }
    if (err instanceof FileUploadError) {
      return new FacebookApiError(HttpStatus.BAD_GATEWAY, fallbackErrorCode, err.message);
    }
    this.logger.error('Unexpected error calling Facebook', err as Error);
    return new FacebookApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'A network error occurred while contacting Facebook. Please try again.',
    );
  }
}

export type { FacebookVideo };
