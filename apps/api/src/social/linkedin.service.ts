import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LinkedInPost, Platform, SocialAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRefreshService } from './token-refresh.service';
import { LinkedInProfile, LinkedInProvider } from './providers/linkedin/linkedin.provider';
import { CreateLinkedInPostDto } from './dto/create-linkedin-post.dto';
import {
  FileUploadError,
  InsufficientScopeError,
  IntegrationNotConfiguredError,
  QuotaExceededError,
  TokenRefreshError,
} from './social.errors';

/** Same shape as CalendarApiError/DriveApiError elsewhere — stable errorCode alongside the HTTP status. */
class LinkedInApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

export interface LinkedInPostDto {
  id: string;
  linkedinPostUrn: string;
  commentary: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly linkedInProvider: LinkedInProvider,
  ) {}

  async getProfile(userId: string): Promise<LinkedInProfile> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      return await this.linkedInProvider.getProfile(accessToken);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'profile_failed');
    }
  }

  async createPost(userId: string, dto: CreateLinkedInPostDto): Promise<LinkedInPostDto> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      const result = await this.linkedInProvider.createPost(accessToken, account.platformUserId, {
        commentary: dto.commentary,
        visibility: dto.visibility,
      });
      const post = await this.prisma.linkedInPost.create({
        data: {
          userId,
          socialAccountId: account.id,
          linkedinPostUrn: result.postUrn,
          commentary: dto.commentary,
          visibility: dto.visibility,
        },
      });
      return this.toDto(post);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'create_failed');
    }
  }

  /**
   * Whether LinkedIn's API actually accepts editing a published post's text is
   * unconfirmed until tested live (see LinkedInProvider.editPost) — a rejection here
   * is mapped to 'edit_failed', which the frontend shows as a specific "LinkedIn
   * doesn't support editing published posts" message rather than a generic error.
   */
  async editPost(userId: string, postId: string, commentary: string): Promise<LinkedInPostDto> {
    const post = await this.prisma.linkedInPost.findFirst({ where: { id: postId, userId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      await this.linkedInProvider.editPost(accessToken, post.linkedinPostUrn, commentary);
      const updated = await this.prisma.linkedInPost.update({
        where: { id: post.id },
        data: { commentary },
      });
      return this.toDto(updated);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'edit_failed');
    }
  }

  /**
   * Reads our own local record, not a live LinkedIn query — LinkedIn doesn't expose a
   * reliable "list my posts" endpoint at standard access tiers. No live token needed,
   * so this doesn't call resolveAccessToken — only that a connection still exists.
   */
  async listPosts(userId: string, limit = 20): Promise<LinkedInPostDto[]> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.LINKEDIN },
    });
    if (!account) {
      throw new LinkedInApiError(HttpStatus.NOT_FOUND, 'no_account_connected', 'No LinkedIn account is connected');
    }

    const posts = await this.prisma.linkedInPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return posts.map((p) => this.toDto(p));
  }

  /** Shared by profile/create/edit: find the connected LinkedIn account and a usable access token. */
  private async resolveAccessToken(userId: string): Promise<{ account: SocialAccount; accessToken: string }> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.LINKEDIN },
    });

    if (!account) {
      throw new LinkedInApiError(HttpStatus.NOT_FOUND, 'no_account_connected', 'No LinkedIn account is connected');
    }
    if (account.needsReauth) {
      throw new LinkedInApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect LinkedIn to continue');
    }

    try {
      const accessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
      return { account, accessToken };
    } catch {
      throw new LinkedInApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect LinkedIn — the stored credentials are no longer valid',
      );
    }
  }

  /** Mirrors DriveUploadService/CalendarService's exact branching — see those files for the reasoning. */
  private async toApiError(err: unknown, socialAccountId: string, fallbackErrorCode: string): Promise<LinkedInApiError> {
    if (err instanceof LinkedInApiError) return err;
    if (err instanceof IntegrationNotConfiguredError) {
      return new LinkedInApiError(HttpStatus.SERVICE_UNAVAILABLE, 'not_configured', err.message);
    }
    if (err instanceof QuotaExceededError) {
      return new LinkedInApiError(HttpStatus.TOO_MANY_REQUESTS, 'quota_exceeded', 'LinkedIn rate limit reached, try again shortly');
    }
    if (err instanceof InsufficientScopeError) {
      await this.prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: { needsReauth: true },
      });
      return new LinkedInApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect LinkedIn to continue');
    }
    if (err instanceof TokenRefreshError) {
      return new LinkedInApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect LinkedIn — the stored credentials are no longer valid',
      );
    }
    if (err instanceof FileUploadError) {
      const message =
        fallbackErrorCode === 'edit_failed'
          ? "LinkedIn doesn't support editing published posts — try deleting and reposting instead"
          : err.message;
      return new LinkedInApiError(HttpStatus.BAD_GATEWAY, fallbackErrorCode, message);
    }
    this.logger.error('Unexpected error calling LinkedIn', err as Error);
    return new LinkedInApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'A network error occurred while contacting LinkedIn. Please try again.',
    );
  }

  private toDto(post: LinkedInPost): LinkedInPostDto {
    return {
      id: post.id,
      linkedinPostUrn: post.linkedinPostUrn,
      commentary: post.commentary,
      visibility: post.visibility,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
