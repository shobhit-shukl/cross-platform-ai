import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Platform, SocialAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { ProviderRegistry } from './providers/provider.registry';
import { ExternalAccount, OAuthTokens } from './providers/social-provider.interface';
import { SocialAccountDto } from './dto/social-account.dto';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providerRegistry: ProviderRegistry,
  ) {}

  /**
   * Creates or updates the connected account for (userId, platform, platformUserId).
   * Google only returns a refresh_token on the first consent (or after prompt=consent
   * forces a fresh one) — if this exchange didn't include one, we keep whatever is
   * already stored rather than overwriting it with null.
   */
  async upsertConnection(
    userId: string,
    platform: Platform,
    tokens: OAuthTokens,
    account: ExternalAccount,
  ): Promise<SocialAccount> {
    const encryptedAccessToken = this.encryption.encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? this.encryption.encrypt(tokens.refreshToken)
      : undefined;

    return this.prisma.socialAccount.upsert({
      where: {
        userId_platform_platformUserId: {
          userId,
          platform,
          platformUserId: account.platformUserId,
        },
      },
      create: {
        userId,
        platform,
        platformUserId: account.platformUserId,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken ?? null,
        scope: tokens.scope,
        expiresAt: tokens.expiresAt,
        needsReauth: false,
      },
      update: {
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        accessToken: encryptedAccessToken,
        // Only overwrite the refresh token if Google actually issued a new one.
        ...(encryptedRefreshToken ? { refreshToken: encryptedRefreshToken } : {}),
        scope: tokens.scope,
        expiresAt: tokens.expiresAt,
        needsReauth: false,
      },
    });
  }

  async listForUser(userId: string): Promise<SocialAccountDto[]> {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return accounts.map((a) => this.toDto(a));
  }

  async disconnect(userId: string, platform: Platform, id: string): Promise<void> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId, platform },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    const provider = this.providerRegistry.get(platform);
    const accessToken = this.encryption.decrypt(account.accessToken);
    await provider.revoke(accessToken);

    await this.prisma.socialAccount.delete({ where: { id: account.id } });
  }

  private toDto(account: SocialAccount): SocialAccountDto {
    return {
      id: account.id,
      platform: account.platform,
      platformUserId: account.platformUserId,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      needsReauth: account.needsReauth,
      createdAt: account.createdAt,
    };
  }
}
