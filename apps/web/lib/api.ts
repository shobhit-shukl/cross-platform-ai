import type {
  CreateEventInput,
  CreateEventResult,
  CurrentUser,
  DriveUploadResult,
  GeneratedVideoMetadata,
  LinkedInPost,
  LinkedInProfile,
  LinkedInVisibility,
  ListCalendarEventsResult,
  ListDriveFilesResult,
  ListFacebookVideosResult,
  ListInstagramMediaResult,
  ListVideosResult,
  PrivacyStatus,
  PublishingJob,
  SocialAccount,
} from './types';

/**
 * Base URL of the CrossPost AI backend.
 *
 * NEXT_PUBLIC_API_URL always wins when it's set — that stays the right way to point a
 * deployment at a different backend, and it's what you'd change if the API ever moves.
 * The fallbacks below just mean the repo deploys correctly with no configuration at
 * all: a production build targets the deployed API, `next dev` targets localhost.
 *
 * Next.js inlines both of these at build time, so this resolves to a plain string in
 * the client bundle — there's no runtime `process` lookup in the browser. Nothing here
 * is secret; it's the same public URL the browser requests anyway.
 */
const DEFAULT_API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://cross-platform-ai.onrender.com'
    : 'http://localhost:5000';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Machine-readable code from the backend (e.g. "reauth_required"), when present. */
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status, body?.errorCode);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getCurrentUser(): Promise<{ user: CurrentUser }> {
  return apiFetch('/auth/me');
}

export function login(email: string, password: string): Promise<{ user: CurrentUser }> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function register(email: string, password: string): Promise<{ user: CurrentUser }> {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export function listSocialAccounts(): Promise<{ accounts: SocialAccount[] }> {
  return apiFetch('/api/social-accounts');
}

export function disconnectSocialAccount(platform: string, id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/social-accounts/${platform.toLowerCase()}/${id}`, { method: 'DELETE' });
}

export function connectYouTubeUrl(): string {
  return `${API_URL}/auth/youtube`;
}

export interface PublishVideoInput {
  video: File;
  title: string;
  description: string;
  privacyStatus: PrivacyStatus;
  onProgress?: (percent: number) => void;
}

/**
 * Uploads via XMLHttpRequest instead of fetch specifically to get real upload-progress
 * events (fetch's Response stream only reports download progress, not upload). Returns
 * an `abort()` handle so the UI's Cancel button can interrupt the browser->backend leg;
 * cancelling the backend->YouTube leg after the job exists goes through
 * cancelPublishingJob instead.
 */
export function publishVideoToYouTube(
  input: PublishVideoInput,
): { promise: Promise<{ job: PublishingJob }>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<{ job: PublishingJob }>((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', input.video);
    formData.append('title', input.title);
    formData.append('description', input.description);
    formData.append('privacyStatus', input.privacyStatus);

    xhr.open('POST', `${API_URL}/api/youtube/publish`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && input.onProgress) {
        input.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response, handled by the status check below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as { job: PublishingJob });
      } else {
        const message = (body as { message?: string })?.message ?? `Upload failed (${xhr.status})`;
        reject(new ApiError(message, xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
    xhr.onabort = () => reject(new ApiError('Upload cancelled', 0));

    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}

export function getPublishingJob(id: string): Promise<{ job: PublishingJob }> {
  return apiFetch(`/api/publishing-jobs/${id}`);
}

export function listPublishingJobs(limit = 10): Promise<{ jobs: PublishingJob[] }> {
  return apiFetch(`/api/publishing-jobs?limit=${limit}`);
}

export function cancelPublishingJob(id: string): Promise<{ job: PublishingJob }> {
  return apiFetch(`/api/publishing-jobs/${id}/cancel`, { method: 'POST' });
}

export function listYouTubeVideos(opts?: {
  pageToken?: string;
  limit?: number;
}): Promise<ListVideosResult> {
  const params = new URLSearchParams();
  if (opts?.pageToken) params.set('pageToken', opts.pageToken);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch(`/api/youtube/videos${qs ? `?${qs}` : ''}`);
}

export function connectGoogleDriveUrl(): string {
  return `${API_URL}/auth/google-drive`;
}

/**
 * Uses raw fetch rather than apiFetch — FormData needs the browser to set its own
 * multipart boundary in the Content-Type header, which apiFetch's fixed
 * 'application/json' header would override.
 */
export async function uploadFileToDrive(
  file: File,
  fileName?: string,
): Promise<{ file: DriveUploadResult }> {
  const formData = new FormData();
  formData.append('file', file);
  if (fileName) formData.append('fileName', fileName);

  const res = await fetch(`${API_URL}/api/drive/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Upload failed (${res.status})`, res.status, body?.errorCode);
  }

  return res.json();
}

export function listDriveFiles(opts?: { pageToken?: string; limit?: number }): Promise<ListDriveFilesResult> {
  const params = new URLSearchParams();
  if (opts?.pageToken) params.set('pageToken', opts.pageToken);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch(`/api/drive/files${qs ? `?${qs}` : ''}`);
}

export function deleteDriveFile(fileId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/drive/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export function connectGoogleCalendarUrl(): string {
  return `${API_URL}/auth/google-calendar`;
}

export function listCalendarEvents(opts?: {
  pageToken?: string;
  limit?: number;
}): Promise<ListCalendarEventsResult> {
  const params = new URLSearchParams();
  if (opts?.pageToken) params.set('pageToken', opts.pageToken);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch(`/api/calendar/events${qs ? `?${qs}` : ''}`);
}

export function createCalendarEvent(input: CreateEventInput): Promise<{ event: CreateEventResult }> {
  return apiFetch('/api/calendar/events', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteCalendarEvent(eventId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/calendar/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
}

export function connectLinkedInUrl(): string {
  return `${API_URL}/auth/linkedin`;
}

export function getLinkedInProfile(): Promise<{ profile: LinkedInProfile }> {
  return apiFetch('/api/linkedin/profile');
}

export function listLinkedInPosts(limit = 20): Promise<{ posts: LinkedInPost[] }> {
  return apiFetch(`/api/linkedin/posts?limit=${limit}`);
}

export function createLinkedInPost(
  commentary: string,
  visibility: LinkedInVisibility,
): Promise<{ post: LinkedInPost }> {
  return apiFetch('/api/linkedin/posts', { method: 'POST', body: JSON.stringify({ commentary, visibility }) });
}

export function editLinkedInPost(id: string, commentary: string): Promise<{ post: LinkedInPost }> {
  return apiFetch(`/api/linkedin/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ commentary }),
  });
}

export function generateVideoMetadata(prompt: string): Promise<{ metadata: GeneratedVideoMetadata }> {
  return apiFetch('/api/ai/video-metadata', { method: 'POST', body: JSON.stringify({ prompt }) });
}

export function connectFacebookUrl(): string {
  return `${API_URL}/auth/facebook`;
}

export function connectInstagramUrl(): string {
  return `${API_URL}/auth/instagram`;
}

export interface PublishVideoWithCaptionInput {
  video: File;
  caption: string;
  onProgress?: (percent: number) => void;
}

/**
 * Shared by Facebook/Instagram: unlike publishVideoToYouTube, the backend publishes
 * synchronously within this one request (no PublishingJob to poll) — the response only
 * arrives once the platform has finished processing the video, which for Instagram's
 * container flow can take a while after the upload bytes themselves finish sending.
 */
function publishVideoWithCaption(
  path: string,
  input: PublishVideoWithCaptionInput,
): { promise: Promise<{ post: { platformPostId: string } }>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<{ post: { platformPostId: string } }>((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', input.video);
    formData.append('caption', input.caption);

    xhr.open('POST', `${API_URL}${path}`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && input.onProgress) {
        input.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response, handled by the status check below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as { post: { platformPostId: string } });
      } else {
        const parsed = body as { message?: string; errorCode?: string } | null;
        reject(new ApiError(parsed?.message ?? `Upload failed (${xhr.status})`, xhr.status, parsed?.errorCode));
      }
    };

    xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
    xhr.onabort = () => reject(new ApiError('Upload cancelled', 0));

    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}

export function publishVideoToFacebook(input: PublishVideoWithCaptionInput) {
  return publishVideoWithCaption('/api/facebook/publish', input);
}

export function listFacebookVideos(opts?: { after?: string; limit?: number }): Promise<ListFacebookVideosResult> {
  const params = new URLSearchParams();
  if (opts?.after) params.set('after', opts.after);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch(`/api/facebook/videos${qs ? `?${qs}` : ''}`);
}

export function publishVideoToInstagram(input: PublishVideoWithCaptionInput) {
  return publishVideoWithCaption('/api/instagram/publish', input);
}

export function listInstagramMedia(opts?: { after?: string; limit?: number }): Promise<ListInstagramMediaResult> {
  const params = new URLSearchParams();
  if (opts?.after) params.set('after', opts.after);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch(`/api/instagram/media${qs ? `?${qs}` : ''}`);
}
