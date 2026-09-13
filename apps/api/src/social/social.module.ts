import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { YouTubeOAuthController } from './providers/youtube/youtube-oauth.controller';
import { YouTubeProvider } from './providers/youtube/youtube.provider';
import { GoogleDriveOAuthController } from './providers/google-drive/google-drive-oauth.controller';
import { GoogleDriveProvider } from './providers/google-drive/google-drive.provider';
import { GoogleCalendarOAuthController } from './providers/google-calendar/google-calendar-oauth.controller';
import { GoogleCalendarProvider } from './providers/google-calendar/google-calendar.provider';
import { LinkedInOAuthController } from './providers/linkedin/linkedin-oauth.controller';
import { LinkedInProvider } from './providers/linkedin/linkedin.provider';
import { FacebookOAuthController } from './providers/facebook/facebook-oauth.controller';
import { FacebookProvider } from './providers/facebook/facebook.provider';
import { InstagramOAuthController } from './providers/instagram/instagram-oauth.controller';
import { InstagramProvider } from './providers/instagram/instagram.provider';
import { ProviderRegistry } from './providers/provider.registry';
import { OAuthStateService } from './oauth-state.service';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';
import { TokenRefreshService } from './token-refresh.service';
import { YouTubePublishController } from './youtube-publish.controller';
import { PublishingJobsController } from './publishing-jobs.controller';
import { PublishingService } from './publishing.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { DriveUploadController } from './drive-upload.controller';
import { DriveUploadService } from './drive-upload.service';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { LinkedInController } from './linkedin.controller';
import { LinkedInService } from './linkedin.service';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';

@Module({
  imports: [AuthModule],
  controllers: [
    YouTubeOAuthController,
    SocialAccountsController,
    YouTubePublishController,
    PublishingJobsController,
    VideosController,
    GoogleDriveOAuthController,
    DriveUploadController,
    GoogleCalendarOAuthController,
    CalendarController,
    LinkedInOAuthController,
    LinkedInController,
    FacebookOAuthController,
    FacebookController,
    InstagramOAuthController,
    InstagramController,
  ],
  providers: [
    YouTubeProvider,
    GoogleDriveProvider,
    GoogleCalendarProvider,
    LinkedInProvider,
    FacebookProvider,
    InstagramProvider,
    ProviderRegistry,
    OAuthStateService,
    SocialAccountsService,
    TokenRefreshService,
    PublishingService,
    VideosService,
    DriveUploadService,
    CalendarService,
    LinkedInService,
    FacebookService,
    InstagramService,
  ],
  exports: [TokenRefreshService],
})
export class SocialModule {}
