import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { ProviderRegistry } from './providers/provider.registry';
import { TokenRefreshError } from './social.errors';

const REFRESH_SKEW_MS = 60_000; // refresh a minute before actual expiry

/**
 * Returns a usable access token for a stored connection, transparently refreshing it
 * via the provider's refresh token when it's expired or about to expire. This is what
 * "support refresh tokens so the user does not need to authorize every time" means in
 * practice — nothing in this milestone calls it yet (no upload feature exists), but
 * every future feature that calls the YouTube API (upload, analytics, ...) should go
 * through this instead of reading SocialAccount.accessToken directly.
 */
@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providerRegistry: ProviderRegistry,
  ) {}

  async getValidAccessToken(socialAccountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUniqueOrThrow({
      where: { id: socialAccountId },
    });

    const isExpired =
      !account.expiresAt || account.expiresAt.getTime() - REFRESH_SKEW_MS <= Date.now();

    if (!isExpired) {
      return this.encryption.decrypt(account.accessToken);
    }

    if (!account.refreshToken) {
      await this.markNeedsReauth(account.id);
      throw new TokenRefreshError('No refresh token stored for this account');
    }

    const provider = this.providerRegistry.get(account.platform);
    const refreshToken = this.encryption.decrypt(account.refreshToken);

    try {
      const tokens = await provider.refresh(refreshToken);
      await this.prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: this.encryption.encrypt(tokens.accessToken),
          expiresAt: tokens.expiresAt,
          needsReauth: false,
        },
      });
      return tokens.accessToken;
    } catch (err) {
      this.logger.warn(`Refresh failed for social account ${account.id}: ${(err as Error).message}`);
      await this.markNeedsReauth(account.id);
      throw new TokenRefreshError();
    }
  }

  private async markNeedsReauth(accountId: string): Promise<void> {
    await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: { needsReauth: true },
    });
  }
}
