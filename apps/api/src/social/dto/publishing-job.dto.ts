import { Platform, PublishStatus } from '@prisma/client';

/** Sanitized shape returned to the frontend for a publishing attempt. */
export class PublishingJobDto {
  id!: string;
  platform!: Platform;
  status!: PublishStatus;
  platformPostId!: string | null;
  title!: string;
  privacyStatus!: string;
  fileName!: string | null;
  error!: string | null;
  errorCode!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
