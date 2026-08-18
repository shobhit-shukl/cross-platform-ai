import { Platform } from '@prisma/client';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Absolute expiry, or undefined if the provider didn't return an expiry. */
  expiresAt?: Date;
  scope?: string;
}

export interface ExternalAccount {
  /** The provider's own id for the connected account (channelId, page id, ...). */
  platformUserId: string;
  displayName?: string;
  avatarUrl?: string;
}

export type PrivacyStatus = 'private' | 'unlisted' | 'public';

export interface PublishInput {
  /** Local path to the already-validated, on-disk video file. */
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  title: string;
  description?: string;
  privacyStatus: PrivacyStatus;
  /** Lets the caller abort an in-flight upload (e.g. the user clicks "Cancel"). */
  signal?: AbortSignal;
}

export interface PublishResult {
  /** The provider's id for the created post (YouTube video id, ...). */
  platformPostId: string;
}

/**
 * Common contract every platform integration implements. Adding Instagram or Facebook
 * later means implementing this interface and registering it in ProviderRegistry —
 * no changes needed to SocialAccountsService, PublishingService, controllers, or the
 * database schema.
 */
export interface SocialProvider {
  readonly platform: Platform;

  /** Required scopes for this provider, most restrictive set that satisfies the feature. */
  readonly scopes: string[];

  buildAuthUrl(state: string): string;

  exchangeCode(code: string): Promise<OAuthTokens>;

  /** Fetches the account identity (e.g. YouTube channel) tied to these tokens. */
  fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount>;

  refresh(refreshToken: string): Promise<OAuthTokens>;

  revoke(token: string): Promise<void>;

  /** Uploads/publishes a video and returns the platform's id for the created post. */
  publish(accessToken: string, input: PublishInput): Promise<PublishResult>;
}

export const SOCIAL_PROVIDER_REGISTRY = 'SOCIAL_PROVIDER_REGISTRY';
