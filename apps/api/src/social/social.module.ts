import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { YouTubeOAuthController } from './providers/youtube/youtube-oauth.controller';
import { YouTubeProvider } from './providers/youtube/youtube.provider';
import { ProviderRegistry } from './providers/provider.registry';
import { OAuthStateService } from './oauth-state.service';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';
import { TokenRefreshService } from './token-refresh.service';
import { YouTubePublishController } from './youtube-publish.controller';
import { PublishingJobsController } from './publishing-jobs.controller';
import { PublishingService } from './publishing.service';

@Module({
  imports: [AuthModule],
  controllers: [
    YouTubeOAuthController,
    SocialAccountsController,
    YouTubePublishController,
    PublishingJobsController,
  ],
  providers: [
    YouTubeProvider,
    ProviderRegistry,
    OAuthStateService,
    SocialAccountsService,
    TokenRefreshService,
    PublishingService,
  ],
  exports: [TokenRefreshService],
})
export class SocialModule {}
