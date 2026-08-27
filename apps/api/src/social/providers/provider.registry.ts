import { Injectable, NotFoundException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { SocialProvider } from './social-provider.interface';
import { YouTubeProvider } from './youtube/youtube.provider';
import { GoogleDriveProvider } from './google-drive/google-drive.provider';
import { GoogleCalendarProvider } from './google-calendar/google-calendar.provider';
import { LinkedInProvider } from './linkedin/linkedin.provider';

/**
 * Central lookup from Platform -> SocialProvider implementation. To add Instagram or
 * Facebook: implement SocialProvider, inject it here, and add it to the map.
 */
@Injectable()
export class ProviderRegistry {
  private readonly providers: Map<Platform, SocialProvider>;

  constructor(
    private readonly youtubeProvider: YouTubeProvider,
    private readonly googleDriveProvider: GoogleDriveProvider,
    private readonly googleCalendarProvider: GoogleCalendarProvider,
    private readonly linkedInProvider: LinkedInProvider,
  ) {
    this.providers = new Map<Platform, SocialProvider>([
      [Platform.YOUTUBE, this.youtubeProvider],
      [Platform.GOOGLE_DRIVE, this.googleDriveProvider],
      [Platform.GOOGLE_CALENDAR, this.googleCalendarProvider],
      [Platform.LINKEDIN, this.linkedInProvider],
    ]);
  }

  get(platform: Platform): SocialProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new NotFoundException(`No integration registered for platform "${platform}"`);
    }
    return provider;
  }
}
