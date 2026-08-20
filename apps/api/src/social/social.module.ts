import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { YouTubeOAuthController } from './providers/youtube/youtube-oauth.controller';
import { YouTubeProvider } from './providers/youtube/youtube.provider';
import { GoogleDriveOAuthController } from './providers/google-drive/google-drive-oauth.controller';
import { GoogleDriveProvider } from './providers/google-drive/google-drive.provider';
import { GoogleCalendarOAuthController } from './providers/google-calendar/google-calendar-oauth.controller';
import { GoogleCalendarProvider } from './providers/google-calendar/google-calendar.provider';
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
  ],
  providers: [
    YouTubeProvider,
    GoogleDriveProvider,
    GoogleCalendarProvider,
    ProviderRegistry,
    OAuthStateService,
    SocialAccountsService,
    TokenRefreshService,
    PublishingService,
    VideosService,
    DriveUploadService,
    CalendarService,
  ],
  exports: [TokenRefreshService],
})
export class SocialModule {}
