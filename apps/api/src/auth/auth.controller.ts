import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_COOKIE_NAME } from '../common/constants';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches default JWT_EXPIRES_IN

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setSessionCookie(res: Response, token: string) {
    // In production the frontend (Vercel) and API (Render) are on different sites, so
    // the browser treats every `fetch(..., { credentials: 'include' })` from the app as
    // a cross-site subresource request — SameSite=Lax would silently refuse to send
    // this cookie and every authenticated call would 401. SameSite=None fixes that, and
    // browsers require Secure alongside it (also correct: production is HTTPS-only).
    // Locally both sides are localhost, so Lax still applies there — it's stricter, and
    // avoids needing HTTPS in dev.
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.register(dto.email, dto.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.email, dto.password);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    // clearCookie only works if these attributes match the ones the cookie was set
    // with — otherwise the browser treats it as a different cookie and leaves the real
    // one in place, silently keeping the user signed in.
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.clearCookie(AUTH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user: { id: user.userId, email: user.email } };
  }
}
