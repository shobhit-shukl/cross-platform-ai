import type { CurrentUser, PrivacyStatus, PublishingJob, SocialAccount } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
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
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status);
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
