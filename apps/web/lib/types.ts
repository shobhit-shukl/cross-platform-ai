export type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'GOOGLE_DRIVE' | 'GOOGLE_CALENDAR' | 'LINKEDIN';

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

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
}

export interface DriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

export interface ListDriveFilesResult {
  items: DriveFile[];
  nextPageToken?: string;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  /** ISO 8601 datetime, e.g. from a <input type="datetime-local"> converted to ISO. */
  startDateTime: string;
  endDateTime: string;
}

export interface CreateEventResult {
  eventId: string;
  summary: string;
  htmlLink: string;
}

export interface CalendarEvent {
  eventId: string;
  summary: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  htmlLink?: string;
  status?: string;
}

export interface ListCalendarEventsResult {
  items: CalendarEvent[];
  nextPageToken?: string;
}

export interface LinkedInProfile {
  memberId: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
}

export type LinkedInVisibility = 'PUBLIC' | 'CONNECTIONS';

export interface LinkedInPost {
  id: string;
  linkedinPostUrn: string;
  commentary: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}
