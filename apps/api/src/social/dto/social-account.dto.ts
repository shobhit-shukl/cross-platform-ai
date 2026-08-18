import { Platform } from '@prisma/client';

/** Sanitized shape returned to the frontend. Never includes accessToken/refreshToken. */
export class SocialAccountDto {
  id!: string;
  platform!: Platform;
  platformUserId!: string;
  displayName!: string | null;
  avatarUrl!: string | null;
  needsReauth!: boolean;
  createdAt!: Date;
}
