import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PublishingService } from './publishing.service';

@UseGuards(JwtAuthGuard)
@Controller('api/publishing-jobs')
export class PublishingJobsController {
  constructor(private readonly publishingService: PublishingService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50) : 10;
    const jobs = await this.publishingService.listJobs(user.userId, parsedLimit);
    return { jobs };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const job = await this.publishingService.getJob(user.userId, id);
    return { job };
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const job = await this.publishingService.cancel(user.userId, id);
    return { job };
  }
}
