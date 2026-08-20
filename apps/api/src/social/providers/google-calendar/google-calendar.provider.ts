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
  OAuthExchangeError,
  QuotaExceededError,
  TokenRefreshError,
} from '../../social.errors';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_PRIMARY_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 250; // Calendar's own ceiling for events.list

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface CalendarPrimaryResponse {
  id?: string;
  summary?: string;
}

interface CalendarEventResource {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface CalendarEventsListResponse {
  items?: CalendarEventResource[];
  nextPageToken?: string;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  /** ISO 8601 datetime, e.g. "2026-08-25T14:00:00-07:00". */
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

/**
 * Google Calendar integration. Implements SocialProvider for its OAuth lifecycle
 * (buildAuthUrl/exchangeCode/fetchAccount/refresh/revoke) so it plugs into the same
 * ProviderRegistry, OAuthStateService, and TokenRefreshService the YouTube and Drive
 * integrations already use — no changes needed to any of that generic infrastructure.
 *
 * publish()/listPosts() are NOT meaningful for a calendar provider and are never called
 * for GOOGLE_CALENDAR — the only two call sites in the codebase hardcode
 * Platform.YOUTUBE. They exist purely so this class satisfies the shared interface.
 */
@Injectable()
export class GoogleCalendarProvider implements SocialProvider {
  readonly platform = Platform.GOOGLE_CALENDAR;
  // As configured in Cloud Console: full read/write access to the user's calendars —
  // broader than the least-privilege pattern used for Drive (drive.file). This is the
  // scope the user explicitly set up; not something to narrow unilaterally.
  readonly scopes = ['https://www.googleapis.com/auth/calendar'];

  private readonly logger = new Logger(GoogleCalendarProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')!;
    this.redirectUri = this.configService.get<string>('GOOGLE_CALENDAR_REDIRECT_URI')!;
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      // Deliberately omitted: include_granted_scopes=true — with three independent
      // integrations now sharing one Google client (YouTube, Drive, Calendar), that
      // flag makes Google fold in whatever scopes were already granted by the OTHER
      // integrations, which Google can then reject if the combined set spans API
      // families it won't allow requesting together. Each "Connect" flow requests only
      // its own scope, as its own independent grant.
      scope: this.scopes.join(' '),
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !data.access_token) {
      this.logger.warn(`Token exchange failed: ${data.error} ${data.error_description ?? ''}`);
      throw new OAuthExchangeError(data.error_description ?? 'Failed to exchange authorization code');
    }

    return this.toOAuthTokens(data);
  }

  async fetchAccount(tokens: OAuthTokens): Promise<ExternalAccount> {
    const response = await fetch(CALENDAR_PRIMARY_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      throw new OAuthExchangeError('Failed to fetch Google Calendar account information');
    }

    const data = (await response.json()) as CalendarPrimaryResponse;
    if (!data.id) {
      throw new OAuthExchangeError('Google did not return calendar account information');
    }

    return {
      platformUserId: data.id,
      displayName: data.summary ?? data.id,
    };
  }

  async refresh(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !data.access_token) {
      this.logger.warn(`Token refresh failed: ${data.error} ${data.error_description ?? ''}`);
      throw new TokenRefreshError(data.error_description);
    }

    return this.toOAuthTokens(data);
  }

  async revoke(token: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      this.logger.warn(`Failed to revoke Calendar token with Google: ${(err as Error).message}`);
    }
  }

  async createEvent(accessToken: string, input: CreateEventInput): Promise<CreateEventResult> {
    const response = await fetch(`${CALENDAR_EVENTS_URL}?fields=id,summary,htmlLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startDateTime },
        end: { dateTime: input.endDateTime },
      }),
    });

    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to create the calendar event');
    }

    const data = (await response.json()) as CalendarEventResource;
    if (!data.id || !data.htmlLink) {
      throw new FileUploadError('Google Calendar did not return the expected event details');
    }

    return { eventId: data.id, summary: data.summary ?? input.summary, htmlLink: data.htmlLink };
  }

  /** Lists upcoming events (timeMin=now), soonest first. */
  async listEvents(
    accessToken: string,
    opts: { pageToken?: string; limit?: number },
  ): Promise<ListCalendarEventsResult> {
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const params = new URLSearchParams({
      maxResults: String(limit),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: new Date().toISOString(),
      fields: 'nextPageToken,items(id,summary,description,status,htmlLink,start,end)',
    });
    if (opts.pageToken) {
      params.set('pageToken', opts.pageToken);
    }

    const response = await fetch(`${CALENDAR_EVENTS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      await this.throwForFailedResponse(response, 'Failed to list calendar events');
    }

    const data = (await response.json()) as CalendarEventsListResponse;
    const items: CalendarEvent[] = (data.items ?? []).map((e) => ({
      eventId: e.id,
      summary: e.summary ?? '(untitled event)',
      description: e.description,
      startDateTime: e.start?.dateTime ?? e.start?.date,
      endDateTime: e.end?.dateTime ?? e.end?.date,
      htmlLink: e.htmlLink,
      status: e.status,
    }));

    return { items, nextPageToken: data.nextPageToken };
  }

  async deleteEvent(accessToken: string, eventId: string): Promise<void> {
    const response = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Google returns 204/410 on success/already-deleted; both mean the end state the
    // caller wants (event gone) is already true.
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      await this.throwForFailedResponse(response, 'Failed to delete the calendar event');
    }
  }

  private async throwForFailedResponse(response: Response, fallbackMessage: string): Promise<never> {
    const body = await response.json().catch(() => null);
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    const message: string = body?.error?.message ?? fallbackMessage;

    this.logger.warn(`Calendar API error (${response.status}, reason=${reason}): ${message}`);

    if (response.status === 401) {
      throw new TokenRefreshError('The access token was rejected by Google Calendar');
    }
    if (response.status === 403) {
      if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || reason === 'dailyLimitExceeded') {
        throw new QuotaExceededError(message);
      }
      throw new InsufficientScopeError(message);
    }
    throw new FileUploadError(message);
  }

  private toOAuthTokens(data: GoogleTokenResponse): OAuthTokens {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  // --- SocialProvider methods that don't apply to a calendar provider ---
  // Never invoked: the only callers of ProviderRegistry.get(...).publish()/.listPosts()
  // in this codebase hardcode Platform.YOUTUBE (see publishing.service.ts, videos.service.ts).

  async publish(): Promise<PublishResult> {
    throw new FileUploadError('Publishing is not supported for Google Calendar');
  }

  async listPosts(): Promise<ListPostsResult> {
    throw new FileUploadError('Listing posts is not supported for Google Calendar');
  }
}
