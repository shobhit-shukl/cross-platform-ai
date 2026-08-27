import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import {
  ExternalAccount,
  ListPostsResult,
  OAuthTokens,
  PublishResult,
  SocialProvider,
} from '../social-provider.interface';
import {
  FileUploadError,
  InsufficientScopeError,
  IntegrationNotConfiguredError,
  OAuthExchangeError,
  QuotaExceededError,
  TokenRefreshError,
} from '../../social.errors';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';

// LinkedIn's versioned REST API requires this header on every call (format: YYYYMM).
// Bump periodically — LinkedIn deprecates versions roughly a year after release.
const LINKEDIN_API_VERSION = '202501';

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface LinkedInUserinfoResponse {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
}

export interface CreateLinkedInPostInput {
  commentary: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
}

export interface LinkedInPostResult {
  postUrn: string;
}

export interface LinkedInProfile {
  memberId: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
}

/**
 * LinkedIn integration. Implements SocialProvider for its OAuth lifecycle
 * (buildAuthUrl/exchangeCode/fetchAccount/refresh/revoke) so it plugs into the same
 * ProviderRegistry, OAuthStateService, and TokenRefreshService the Google integrations
 * already use — no changes needed to any of that generic infrastructure.
 *
 * Unlike the Google providers, credentials are optional in env validation (see
 * env.validation.ts) so the whole API isn't blocked from booting before a LinkedIn
 * Developer app exists. Every method here checks configuration itself and fails with a
 * specific, actionable error instead.
 *
 * publish()/listPosts() are NOT meaningful here (LinkedIn posts have their own
 * createPost/editPost below, shaped nothing like YouTube's PublishInput) and are never
 * called for LINKEDIN — the only two call sites in the codebase hardcode
 * Platform.YOUTUBE. They exist purely so this class satisfies the shared interface.
 */
@Injectable()
export class LinkedInProvider implements SocialProvider {
  readonly platform = Platform.LINKEDIN;
  // OIDC scopes for identity (view profile), w_member_social to create/edit posts on
  // the member's own behalf. This is the minimum for "view profile + post," matching
  // the least-privilege approach used for every prior platform.
  readonly scopes = ['openid', 'profile', 'email', 'w_member_social'];

  private readonly logger = new Logger(LinkedInProvider.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID') || undefined;
    this.clientSecret = this.configService.get<string>('LINKEDIN_CLIENT_SECRET') || undefined;
    this.redirectUri = this.configService.get<string>('LINKEDIN_REDIRECT_URI') || undefined;
  }

  /** Throws a specific, actionable error rather than sending a doomed request with an empty client_id. */
  private requireConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new IntegrationNotConfiguredError(
        'LinkedIn is not configured yet — set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI in apps/api/.env',
      );
    }
    return { clientId: this.clientId, clientSecret: this.clientSecret, redirectUri: this.redirectUri };
  }

  buildAuthUrl(state: string): string {
    const { clientId, redirectUri } = this.requireConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state,
    });
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = this.requireConfig();
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as LinkedInTokenResponse;

    if (!response.ok || !data.access_token) {
      this.logger.warn(`Token exchange failed: ${data.error} ${data.error_description ?? ''}`);
      throw new OAuthExchangeError(data.error_description ?? 'Failed to exchange authorization code');
    }

    return this.toOAuthTokens(data);
  }

  async fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount> {
    const response = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      throw new OAuthExchangeError('Failed to fetch LinkedIn profile information');
    }

    const data = (await response.json()) as LinkedInUserinfoResponse;
    if (!data.sub) {
      throw new OAuthExchangeError('LinkedIn did not return profile information');
    }

    return {
      platformUserId: data.sub,
      displayName: data.name,
      avatarUrl: data.picture,
    };
  }

  /**
   * LinkedIn only issues a refresh_token if the "Programmatic Refresh Tokens" product
   * is enabled on the app — otherwise this is simply never called with a stored token
   * in the first place (TokenRefreshService already marks needsReauth when no refresh
   * token was ever stored, no special-casing needed here).
   */
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.requireConfig();
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as LinkedInTokenResponse;

    if (!response.ok || !data.access_token) {
      this.logger.warn(`Token refresh failed: ${data.error} ${data.error_description ?? ''}`);
      throw new TokenRefreshError(data.error_description);
    }

    return this.toOAuthTokens(data);
  }

  /**
   * LinkedIn does not publish a token-revoke endpoint the way Google does. This is a
   * documented no-op: disconnecting removes our stored copy, but the user must remove
   * "CrossPost AI" from LinkedIn's own Settings → Permitted Services to fully revoke
   * access on LinkedIn's side.
   */
  async revoke(_token: string): Promise<void> {
    this.logger.log('LinkedIn has no public token-revoke endpoint — local disconnect only.');
  }

  async getProfile(accessToken: string): Promise<LinkedInProfile> {
    const response = await fetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to fetch LinkedIn profile');
    }
    const data = (await response.json()) as LinkedInUserinfoResponse;
    return { memberId: data.sub ?? '', name: data.name, email: data.email, pictureUrl: data.picture };
  }

  async createPost(accessToken: string, memberId: string, input: CreateLinkedInPostInput): Promise<LinkedInPostResult> {
    const response = await fetch(LINKEDIN_POSTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${memberId}`,
        commentary: input.commentary,
        visibility: input.visibility,
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });

    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to create the LinkedIn post');
    }

    // LinkedIn returns the created post's URN in this response header, not the body.
    const postUrn = response.headers.get('x-restli-id') ?? response.headers.get('x-linkedin-id');
    if (!postUrn) {
      throw new FileUploadError('LinkedIn did not return the created post id');
    }
    return { postUrn };
  }

  /**
   * Attempts LinkedIn's Rest.li partial-update convention. Whether LinkedIn's API
   * actually accepts a commentary edit on a published post is unconfirmed until tested
   * live — if it rejects the call, the failure surfaces through the normal error
   * mapping below (LinkedInService turns that into a specific "editing isn't
   * supported" message rather than a generic failure).
   */
  async editPost(accessToken: string, postUrn: string, commentary: string): Promise<void> {
    const response = await fetch(`${LINKEDIN_POSTS_URL}/${encodeURIComponent(postUrn)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
        'X-RestLi-Method': 'PARTIAL_UPDATE',
      },
      body: JSON.stringify({ patch: { $set: { commentary } } }),
    });

    if (response.ok) return;

    // Deliberately NOT reusing throwForFailedResponse's 403→InsufficientScopeError /
    // 429→QuotaExceededError assumptions here: those are tuned for create/read calls,
    // where a 403 really does mean "your token lacks permission." For an edit, LinkedIn
    // might reject with 400/403/404/405 simply because editing published post content
    // isn't supported at all — that's a capability gap, not something reconnecting
    // fixes. Only 401 (token itself rejected) gets the normal token-refresh treatment;
    // every other failure is reported as-is and LinkedInService turns it into the
    // specific "editing isn't supported" message rather than prompting a reconnect.
    if (response.status === 401) {
      throw new TokenRefreshError('The access token was rejected by LinkedIn');
    }
    const body = await response.json().catch(() => null);
    const message: string = body?.message ?? `LinkedIn rejected the edit (HTTP ${response.status})`;
    this.logger.warn(`LinkedIn edit rejected (${response.status}): ${message}`);
    throw new FileUploadError(message);
  }

  private async throwForFailedResponse(response: Response, fallbackMessage: string): Promise<never> {
    const body = await response.json().catch(() => null);
    const message: string = body?.message ?? fallbackMessage;

    this.logger.warn(`LinkedIn API error (${response.status}): ${message}`);

    if (response.status === 401) {
      throw new TokenRefreshError('The access token was rejected by LinkedIn');
    }
    if (response.status === 429) {
      throw new QuotaExceededError(message);
    }
    if (response.status === 403) {
      throw new InsufficientScopeError(message);
    }
    throw new FileUploadError(message);
  }

  private toOAuthTokens(data: LinkedInTokenResponse): OAuthTokens {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  // --- SocialProvider methods that don't apply to LinkedIn's post shape ---
  // Never invoked: the only callers of ProviderRegistry.get(...).publish()/.listPosts()
  // in this codebase hardcode Platform.YOUTUBE (see publishing.service.ts, videos.service.ts).

  async publish(): Promise<PublishResult> {
    throw new FileUploadError('Use createPost for LinkedIn, not publish');
  }

  async listPosts(): Promise<ListPostsResult> {
    throw new FileUploadError('LinkedIn posts are tracked locally — see LinkedInService.listPosts');
  }
}
