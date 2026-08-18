import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Platform, PublishingJob, PublishStatus } from '@prisma/client';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from './providers/provider.registry';
import { TokenRefreshService } from './token-refresh.service';
import { PublishVideoDto } from './dto/publish-video.dto';
import { PublishingJobDto } from './dto/publishing-job.dto';
import { validateVideoFile } from './video-file-validator';
import {
  InsufficientScopeError,
  QuotaExceededError,
  TokenRefreshError,
  VideoUploadError,
} from './social.errors';

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

interface UploadedFile {
  path: string;
  size: number;
  originalname: string;
}

/**
 * Owns the lifecycle of a publish attempt: create a QUEUED job row immediately so the
 * frontend has something to poll, then process the actual upload in the background.
 * No queue library yet (Redis/BullMQ is explicitly out of scope) — the upload just runs
 * as an un-awaited async function on the same Node process. Good enough for one user
 * publishing one video at a time; the seam is `processJob`, which a real queue worker
 * would call instead of this in-process fire-and-forget.
 */
@Injectable()
export class PublishingService implements OnModuleInit {
  private readonly logger = new Logger(PublishingService.name);

  /** In-flight uploads, keyed by job id, so a cancel request can abort the network call. */
  private readonly activeUploads = new Map<string, AbortController>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistry,
    private readonly tokenRefreshService: TokenRefreshService,
  ) {}

  /**
   * A job left in QUEUED/PROCESSING on boot means the previous process died mid-upload
   * (crash or restart) — nothing is actually running for it anymore, so it would poll
   * forever otherwise. Mark it failed instead of leaving it stuck.
   */
  async onModuleInit() {
    const { count } = await this.prisma.publishingJob.updateMany({
      where: { status: { in: [PublishStatus.QUEUED, PublishStatus.PROCESSING] } },
      data: {
        status: PublishStatus.FAILED,
        errorCode: 'interrupted',
        error: 'The server restarted while this upload was in progress. Please try again.',
      },
    });
    if (count > 0) {
      this.logger.warn(`Marked ${count} orphaned publishing job(s) as failed on startup`);
    }
  }

  async createJob(userId: string, dto: PublishVideoDto, file: UploadedFile): Promise<PublishingJobDto> {
    const job = await this.prisma.publishingJob.create({
      data: {
        userId,
        platform: Platform.YOUTUBE,
        status: PublishStatus.QUEUED,
        title: dto.title,
        description: dto.description,
        privacyStatus: dto.privacyStatus,
        fileName: file.originalname,
        fileSizeBytes: BigInt(file.size),
      },
    });

    // Intentionally not awaited: the HTTP response returns the job immediately and the
    // frontend polls GET /api/publishing-jobs/:id for status.
    this.processJob(job.id, file.path).catch((err) => {
      this.logger.error(`Unhandled error processing publishing job ${job.id}`, err as Error);
    });

    return this.toDto(job);
  }

  private async processJob(jobId: string, filePath: string): Promise<void> {
    try {
      const job = await this.prisma.publishingJob.findUniqueOrThrow({ where: { id: jobId } });

      const account = await this.prisma.socialAccount.findFirst({
        where: { userId: job.userId, platform: Platform.YOUTUBE },
      });

      if (!account) {
        await this.fail(jobId, 'no_account_connected', 'No YouTube account is connected');
        return;
      }

      if (account.needsReauth || !(account.scope ?? '').includes(UPLOAD_SCOPE)) {
        await this.fail(
          jobId,
          'reauth_required',
          'Reconnect YouTube to grant upload permission',
        );
        return;
      }

      await this.prisma.publishingJob.update({
        where: { id: jobId },
        data: { status: PublishStatus.PROCESSING, socialAccountId: account.id },
      });

      const validation = await validateVideoFile(filePath, Number(job.fileSizeBytes ?? 0));
      if (!validation.ok) {
        await this.fail(jobId, 'invalid_video', validation.reason);
        return;
      }

      let accessToken: string;
      try {
        accessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
      } catch {
        await this.fail(jobId, 'reauth_required', 'Reconnect YouTube — the stored credentials are no longer valid');
        return;
      }

      const abortController = new AbortController();
      this.activeUploads.set(jobId, abortController);

      try {
        const provider = this.providerRegistry.get(Platform.YOUTUBE);
        const result = await provider.publish(accessToken, {
          filePath,
          fileSizeBytes: Number(job.fileSizeBytes ?? 0),
          mimeType: validation.mimeType,
          title: job.title,
          description: job.description ?? undefined,
          privacyStatus: job.privacyStatus as 'private' | 'unlisted' | 'public',
          signal: abortController.signal,
        });

        await this.prisma.publishingJob.update({
          where: { id: jobId },
          data: { status: PublishStatus.PUBLISHED, platformPostId: result.platformPostId },
        });
      } catch (err) {
        await this.failFromError(jobId, err);
      } finally {
        this.activeUploads.delete(jobId);
      }
    } finally {
      await unlink(filePath).catch(() => {
        // Best-effort cleanup — a leftover temp file isn't worth failing the job over.
      });
    }
  }

  private async failFromError(jobId: string, err: unknown): Promise<void> {
    if (err instanceof QuotaExceededError) {
      await this.fail(jobId, 'quota_exceeded', 'Daily YouTube upload quota reached, try again tomorrow');
    } else if (err instanceof InsufficientScopeError) {
      await this.markAccountNeedsReauth(jobId);
      await this.fail(jobId, 'insufficient_scope', 'Reconnect YouTube to grant upload permission');
    } else if (err instanceof TokenRefreshError) {
      await this.fail(jobId, 'reauth_required', 'Reconnect YouTube — the stored credentials are no longer valid');
    } else if (err instanceof VideoUploadError) {
      await this.fail(jobId, 'upload_failed', err.message);
    } else if ((err as Error)?.name === 'AbortError') {
      await this.fail(jobId, 'cancelled', 'Upload cancelled');
    } else {
      this.logger.error(`Unexpected error publishing job ${jobId}`, err as Error);
      await this.fail(jobId, 'network_error', 'A network error interrupted the upload. Please try again.');
    }
  }

  private async markAccountNeedsReauth(jobId: string): Promise<void> {
    const job = await this.prisma.publishingJob.findUnique({ where: { id: jobId } });
    if (job?.socialAccountId) {
      await this.prisma.socialAccount.update({
        where: { id: job.socialAccountId },
        data: { needsReauth: true },
      });
    }
  }

  private async fail(jobId: string, errorCode: string, message: string): Promise<void> {
    await this.prisma.publishingJob.update({
      where: { id: jobId },
      data: { status: PublishStatus.FAILED, errorCode, error: message },
    });
  }

  /** Aborts the in-flight upload to Google, if this process is the one running it. */
  async cancel(userId: string, jobId: string): Promise<PublishingJobDto> {
    const job = await this.getOwnedJob(userId, jobId);

    if (job.status === PublishStatus.PUBLISHED || job.status === PublishStatus.FAILED) {
      return this.toDto(job);
    }

    this.activeUploads.get(jobId)?.abort();
    this.activeUploads.delete(jobId);

    const updated = await this.prisma.publishingJob.update({
      where: { id: jobId },
      data: { status: PublishStatus.FAILED, errorCode: 'cancelled', error: 'Cancelled by user' },
    });
    return this.toDto(updated);
  }

  async getJob(userId: string, jobId: string): Promise<PublishingJobDto> {
    const job = await this.getOwnedJob(userId, jobId);
    return this.toDto(job);
  }

  async listJobs(userId: string, limit = 10): Promise<PublishingJobDto[]> {
    const jobs = await this.prisma.publishingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return jobs.map((j) => this.toDto(j));
  }

  private async getOwnedJob(userId: string, jobId: string): Promise<PublishingJob> {
    const job = await this.prisma.publishingJob.findFirst({ where: { id: jobId, userId } });
    if (!job) {
      throw new NotFoundException('Publishing job not found');
    }
    return job;
  }

  private toDto(job: PublishingJob): PublishingJobDto {
    return {
      id: job.id,
      platform: job.platform,
      status: job.status,
      platformPostId: job.platformPostId,
      title: job.title,
      privacyStatus: job.privacyStatus,
      fileName: job.fileName,
      error: job.error,
      errorCode: job.errorCode,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
