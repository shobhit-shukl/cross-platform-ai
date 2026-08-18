import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from './providers/provider.registry';
import { ListPostsResult } from './providers/social-provider.interface';
import { TokenRefreshService } from './token-refresh.service';
import { InsufficientScopeError, QuotaExceededError, TokenRefreshError } from './social.errors';

/** Thin HTTP wrapper so the frontend gets a stable `errorCode` alongside the status, matching the codes already used by the publish-job error flow. */
class VideosApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistry,
    private readonly tokenRefreshService: TokenRefreshService,
  ) {}

  async listVideos(
    userId: string,
    opts: { pageToken?: string; limit?: number },
  ): Promise<ListPostsResult> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.YOUTUBE },
    });

    if (!account) {
      throw new VideosApiError(
        HttpStatus.NOT_FOUND,
        'no_account_connected',
        'No YouTube account is connected',
      );
    }

    if (account.needsReauth) {
      throw new VideosApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect YouTube to view your videos',
      );
    }

    let accessToken: string;
    try {
      accessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
    } catch {
      throw new VideosApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect YouTube — the stored credentials are no longer valid',
      );
    }

    try {
      const provider = this.providerRegistry.get(Platform.YOUTUBE);
      return await provider.listPosts(accessToken, opts);
    } catch (err) {
      throw this.toApiError(err);
    }
  }

  private toApiError(err: unknown): VideosApiError {
    if (err instanceof QuotaExceededError) {
      return new VideosApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'quota_exceeded',
        'Daily YouTube quota reached, try again tomorrow',
      );
    }
    if (err instanceof TokenRefreshError || err instanceof InsufficientScopeError) {
      return new VideosApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect YouTube to view your videos',
      );
    }
    this.logger.error('Unexpected error listing YouTube videos', err as Error);
    return new VideosApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'A network error occurred while contacting YouTube. Please try again.',
    );
  }
}
