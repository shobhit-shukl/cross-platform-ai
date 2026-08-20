import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Platform, SocialAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenRefreshService } from './token-refresh.service';
import {
  CreateEventInput,
  CreateEventResult,
  GoogleCalendarProvider,
  ListCalendarEventsResult,
} from './providers/google-calendar/google-calendar.provider';
import { FileUploadError, InsufficientScopeError, QuotaExceededError, TokenRefreshError } from './social.errors';

/** Same shape as DriveApiError/VideosApiError elsewhere — stable errorCode alongside the HTTP status. */
class CalendarApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly googleCalendarProvider: GoogleCalendarProvider,
  ) {}

  async createEvent(userId: string, input: CreateEventInput): Promise<CreateEventResult> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      return await this.googleCalendarProvider.createEvent(accessToken, input);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'create_failed');
    }
  }

  async listEvents(
    userId: string,
    opts: { pageToken?: string; limit?: number },
  ): Promise<ListCalendarEventsResult> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      return await this.googleCalendarProvider.listEvents(accessToken, opts);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'list_failed');
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const { account, accessToken } = await this.resolveAccessToken(userId);
    try {
      await this.googleCalendarProvider.deleteEvent(accessToken, eventId);
    } catch (err) {
      throw await this.toApiError(err, account.id, 'delete_failed');
    }
  }

  /** Shared by create/list/delete: find the connected Calendar account and a usable access token. */
  private async resolveAccessToken(userId: string): Promise<{ account: SocialAccount; accessToken: string }> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { userId, platform: Platform.GOOGLE_CALENDAR },
    });

    if (!account) {
      throw new CalendarApiError(
        HttpStatus.NOT_FOUND,
        'no_account_connected',
        'No Google Calendar account is connected',
      );
    }
    if (account.needsReauth) {
      throw new CalendarApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Google Calendar to continue');
    }

    try {
      const accessToken = await this.tokenRefreshService.getValidAccessToken(account.id);
      return { account, accessToken };
    } catch {
      throw new CalendarApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Google Calendar — the stored credentials are no longer valid',
      );
    }
  }

  /** Mirrors DriveUploadService.toApiError's exact branching — see that file for the reasoning. */
  private async toApiError(err: unknown, socialAccountId: string, fallbackErrorCode: string): Promise<CalendarApiError> {
    if (err instanceof CalendarApiError) return err;
    if (err instanceof QuotaExceededError) {
      return new CalendarApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'quota_exceeded',
        'Google Calendar rate limit reached, try again shortly',
      );
    }
    if (err instanceof InsufficientScopeError) {
      await this.prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: { needsReauth: true },
      });
      return new CalendarApiError(HttpStatus.CONFLICT, 'reauth_required', 'Reconnect Google Calendar to continue');
    }
    if (err instanceof TokenRefreshError) {
      return new CalendarApiError(
        HttpStatus.CONFLICT,
        'reauth_required',
        'Reconnect Google Calendar — the stored credentials are no longer valid',
      );
    }
    if (err instanceof FileUploadError) {
      return new CalendarApiError(HttpStatus.BAD_GATEWAY, fallbackErrorCode, err.message);
    }
    this.logger.error('Unexpected error calling Google Calendar', err as Error);
    return new CalendarApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'A network error occurred while contacting Google Calendar. Please try again.',
    );
  }
}
