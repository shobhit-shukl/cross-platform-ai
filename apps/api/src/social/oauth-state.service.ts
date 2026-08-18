import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Platform } from '@prisma/client';
import { OAUTH_STATE_TTL_SECONDS } from '../common/constants';

interface StatePayload {
  sub: string; // userId
  platform: Platform;
  nonce: string;
}

/**
 * Signs and verifies the OAuth `state` param. Binds a callback back to (a) the user who
 * initiated it and (b) the specific browser session, via a nonce echoed in an httpOnly
 * cookie (double-submit pattern) — this is what stops a forged callback from linking a
 * YouTube channel to someone else's account.
 */
@Injectable()
export class OAuthStateService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generate(userId: string, platform: Platform): { state: string; nonce: string } {
    const nonce = randomBytes(24).toString('hex');
    const state = this.jwtService.sign(
      { sub: userId, platform, nonce } satisfies StatePayload,
      {
        secret: this.configService.get<string>('OAUTH_STATE_SECRET'),
        expiresIn: OAUTH_STATE_TTL_SECONDS,
      },
    );
    return { state, nonce };
  }

  /** Throws if the token is invalid/expired, the nonce doesn't match the cookie, or the platform differs. */
  verify(state: string, cookieNonce: string | undefined, expectedPlatform: Platform): { userId: string } {
    const payload = this.jwtService.verify<StatePayload>(state, {
      secret: this.configService.get<string>('OAUTH_STATE_SECRET'),
    });

    if (!cookieNonce || payload.nonce !== cookieNonce) {
      throw new Error('OAuth state nonce mismatch');
    }
    if (payload.platform !== expectedPlatform) {
      throw new Error('OAuth state platform mismatch');
    }

    return { userId: payload.sub };
  }
}
