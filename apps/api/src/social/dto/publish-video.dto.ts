import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PRIVACY_STATUSES = ['private', 'unlisted', 'public'] as const;

export class PublishVideoDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be 100 characters or fewer' })
  // YouTube rejects titles containing angle brackets outright.
  @Matches(/^[^<>]*$/, { message: 'Title cannot contain "<" or ">"' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must be 5000 characters or fewer' })
  description?: string;

  @IsIn(PRIVACY_STATUSES, { message: 'Privacy must be one of: private, unlisted, public' })
  privacyStatus!: (typeof PRIVACY_STATUSES)[number];
}
