import { Controller, Get, Logger, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import type { Request, Response } from 'express';
import { OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_TTL_SECONDS } from '../../../common/constants';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OAuthStateService } from '../../oauth-state.service';
import { SocialAccountsService } from '../../social-accounts.service';
import {
  InsufficientScopeError,
  IntegrationNotConfiguredError,
  NoInstagramAccountError,
  OAuthExchangeError,
  TokenRefreshError,
} from '../../social.errors';
import { InstagramProvider } from './instagram.provider';

type ConnectionErrorReason =
  | 'access_denied'
  | 'invalid_callback'
  | 'invalid_state'
  | 'exchange_failed'
  | 'insufficient_scope'
  | 'not_configured'
  | 'no_instagram_account'
  | 'unknown_error';

/** Mirrors the Google/LinkedIn/Facebook OAuth controllers' connect/callback shape exactly. */
@Controller('auth/instagram')
export class InstagramOAuthController {
  private readonly logger = new Logger(InstagramOAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly instagramProvider: InstagramProvider,
    private readonly oauthStateService: OAuthStateService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  connect(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    let authUrl: string;
    try {
      const { state, nonce } = this.oauthStateService.generate(user.userId, Platform.INSTAGRAM);
      authUrl = this.instagramProvider.buildAuthUrl(state);

      res.cookie(OAUTH_STATE_COOKIE_NAME, nonce, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
        path: '/',
      });
    } catch (err) {
      if (err instanceof IntegrationNotConfiguredError) {
        return this.redirectWithError(res, 'not_configured');
      }
      throw err;
    }

    return res.redirect(authUrl);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/' });

    if (error) {
      this.logger.log(`Instagram returned OAuth error: ${error}`);
      return this.redirectWithError(res, error === 'access_denied' ? 'access_denied' : 'unknown_error');
    }

    if (!code || !state) {
      return this.redirectWithError(res, 'invalid_callback');
    }

    let userId: string;
    try {
      const cookieNonce: string | undefined = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
      const result = this.oauthStateService.verify(state, cookieNonce, Platform.INSTAGRAM);
      userId = result.userId;
    } catch (err) {
      this.logger.warn(`OAuth state verification failed: ${(err as Error).message}`);
      return this.redirectWithError(res, 'invalid_state');
    }

    try {
      const tokens = await this.instagramProvider.exchangeCode(code);
      const account = await this.instagramProvider.fetchAccount(tokens);

      await this.socialAccountsService.upsertConnection(userId, Platform.INSTAGRAM, tokens, account);

      return res.redirect(`${this.frontendUrl}/dashboard?connection=success&platform=instagram`);
    } catch (err) {
      return this.redirectWithError(res, this.classifyError(err));
    }
  }

  private classifyError(err: unknown): ConnectionErrorReason {
    if (err instanceof NoInstagramAccountError) return 'no_instagram_account';
    if (err instanceof InsufficientScopeError) return 'insufficient_scope';
    if (err instanceof IntegrationNotConfiguredError) return 'not_configured';
    if (err instanceof OAuthExchangeError) return 'exchange_failed';
    if (err instanceof TokenRefreshError) return 'exchange_failed';
    this.logger.error('Unexpected error during Instagram OAuth callback', err as Error);
    return 'unknown_error';
  }

  private redirectWithError(res: Response, reason: ConnectionErrorReason) {
    return res.redirect(
      `${this.frontendUrl}/dashboard?connection=error&reason=${encodeURIComponent(reason)}&platform=instagram`,
    );
  }
}
