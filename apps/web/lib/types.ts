export type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK';

export interface SocialAccount {
  id: string;
  platform: Platform;
  platformUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  needsReauth: boolean;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  email: string;
}

export type PrivacyStatus = 'private' | 'unlisted' | 'public';

export type PublishStatus = 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';

export interface PublishingJob {
  id: string;
  platform: Platform;
  status: PublishStatus;
  platformPostId: string | null;
  title: string;
  privacyStatus: string;
  fileName: string | null;
  error: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalPost {
  platformPostId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  privacyStatus: PrivacyStatus;
  publishedAt: string;
  durationSeconds?: number;
  viewCount?: number;
  isEmbeddable: boolean;
}

export interface ListVideosResult {
  items: ExternalPost[];
  nextPageToken?: string;
}
