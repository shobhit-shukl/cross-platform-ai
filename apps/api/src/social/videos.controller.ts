import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VideosService } from './videos.service';

@UseGuards(JwtAuthGuard)
@Controller('api/youtube')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get('videos')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('pageToken') pageToken?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 24, 1), 50) : undefined;
    const result = await this.videosService.listVideos(user.userId, { pageToken, limit: parsedLimit });
    return result;
  }
}
