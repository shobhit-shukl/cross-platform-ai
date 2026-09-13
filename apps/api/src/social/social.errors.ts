/** Thrown when Google (or another provider) denies consent or the auth code exchange fails. */
export class OAuthExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthExchangeError';
  }
}

/** Thrown when the granted scopes don't include everything we required. */
export class InsufficientScopeError extends Error {
  constructor(message = 'Required permissions were not granted') {
    super(message);
    this.name = 'InsufficientScopeError';
  }
}

/** Thrown when the Google account has no YouTube channel to connect. */
export class NoChannelError extends Error {
  constructor(message = 'No YouTube channel found on this Google account') {
    super(message);
    this.name = 'NoChannelError';
  }
}

/** Thrown when a stored refresh token has been revoked or expired (invalid_grant). */
export class TokenRefreshError extends Error {
  constructor(message = 'The stored refresh token is no longer valid') {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

/** Thrown when the provider's daily/per-user upload quota has been exhausted. */
export class QuotaExceededError extends Error {
  constructor(message = 'The daily upload quota has been reached') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/** Thrown when the video upload itself fails (rejected file, provider-side error, ...). */
export class VideoUploadError extends Error {
  constructor(message = 'Failed to upload the video') {
    super(message);
    this.name = 'VideoUploadError';
  }
}

/** Thrown when a file upload to a storage provider (Google Drive, ...) fails. */
export class FileUploadError extends Error {
  constructor(message = 'Failed to upload the file') {
    super(message);
    this.name = 'FileUploadError';
  }
}

/** Thrown when a provider's credentials (client id/secret/redirect URI) aren't set yet. */
export class IntegrationNotConfiguredError extends Error {
  constructor(message = 'This integration is not configured yet') {
    super(message);
    this.name = 'IntegrationNotConfiguredError';
  }
}

/** Thrown when the Facebook user has no Page (or no Page they administer) to connect. */
export class NoFacebookPageError extends Error {
  constructor(message = 'No Facebook Page found on this account') {
    super(message);
    this.name = 'NoFacebookPageError';
  }
}

/** Thrown when none of the user's Facebook Pages have a linked Instagram Business/Creator account. */
export class NoInstagramAccountError extends Error {
  constructor(message = 'No Instagram Business account is linked to any of your Facebook Pages') {
    super(message);
    this.name = 'NoInstagramAccountError';
  }
}
