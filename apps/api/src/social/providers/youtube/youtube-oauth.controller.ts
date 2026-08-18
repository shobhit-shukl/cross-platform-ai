import { Controller, Get, Logger, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_SECONDS,
} from '../../../common/constants';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OAuthStateService } from '../../oauth-state.service';
import { SocialAccountsService } from '../../social-accounts.service';
import {
  InsufficientScopeError,
  NoChannelError,
  OAuthExchangeError,
  TokenRefreshError,
} from '../../social.errors';
import { YouTubeProvider } from './youtube.provider';

type ConnectionErrorReason =
  | 'access_denied'
  | 'invalid_callback'
  | 'invalid_state'
  | 'exchange_failed'
  | 'insufficient_scope'
  | 'no_channel'
  | 'fetch_channel_failed'
  | 'unknown_error';

@Controller('auth/youtube')
export class YouTubeOAuthController {
  private readonly logger = new Logger(YouTubeOAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly youtubeProvider: YouTubeProvider,
    private readonly oauthStateService: OAuthStateService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
  }

  /** Step 1: authenticated user starts the connect flow -> redirect to Google's consent screen. */
  @UseGuards(JwtAuthGuard)
  @Get()
  connect(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { state, nonce } = this.oauthStateService.generate(user.userId, Platform.YOUTUBE);

    res.cookie(OAUTH_STATE_COOKIE_NAME, nonce, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
      path: '/',
    });

    return res.redirect(this.youtubeProvider.buildAuthUrl(state));
  }

  /** Step 2: Google redirects back here with either `code` or `error`. */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Always clear the one-time state cookie, whatever the outcome.
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/' });

    if (error) {
      this.logger.log(`Google returned OAuth error: ${error}`);
      return this.redirectWithError(res, error === 'access_denied' ? 'access_denied' : 'unknown_error');
    }

    if (!code || !state) {
      return this.redirectWithError(res, 'invalid_callback');
    }

    let userId: string;
    try {
      const cookieNonce: string | undefined = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
      const result = this.oauthStateService.verify(state, cookieNonce, Platform.YOUTUBE);
      userId = result.userId;
    } catch (err) {
      this.logger.warn(`OAuth state verification failed: ${(err as Error).message}`);
      return this.redirectWithError(res, 'invalid_state');
    }

    try {
      const tokens = await this.youtubeProvider.exchangeCode(code);

      const grantedScopes = new Set((tokens.scope ?? '').split(' ').filter(Boolean));
      const missingScope = this.youtubeProvider.scopes.some((s) => !grantedScopes.has(s));
      if (missingScope) {
        await this.youtubeProvider.revoke(tokens.accessToken);
        throw new InsufficientScopeError();
      }

      const account = await this.youtubeProvider.fetchAccount(tokens);

      await this.socialAccountsService.upsertConnection(userId, Platform.YOUTUBE, tokens, account);

      return res.redirect(`${this.frontendUrl}/dashboard?connection=success&platform=youtube`);
    } catch (err) {
      return this.redirectWithError(res, this.classifyError(err));
    }
  }

  private classifyError(err: unknown): ConnectionErrorReason {
    if (err instanceof InsufficientScopeError) return 'insufficient_scope';
    if (err instanceof NoChannelError) return 'no_channel';
    if (err instanceof OAuthExchangeError) return 'exchange_failed';
    if (err instanceof TokenRefreshError) return 'exchange_failed';
    this.logger.error('Unexpected error during YouTube OAuth callback', err as Error);
    return 'unknown_error';
  }

  private redirectWithError(res: Response, reason: ConnectionErrorReason) {
    return res.redirect(
      `${this.frontendUrl}/dashboard?connection=error&reason=${encodeURIComponent(reason)}&platform=youtube`,
    );
  }
}
