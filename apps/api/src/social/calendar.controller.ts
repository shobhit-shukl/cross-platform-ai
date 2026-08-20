import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('pageToken') pageToken?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 24, 1), 250) : undefined;
    return this.calendarService.listEvents(user.userId, { pageToken, limit: parsedLimit });
  }

  @Post('events')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    const event = await this.calendarService.createEvent(user.userId, dto);
    return { event };
  }

  @Delete('events/:eventId')
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('eventId') eventId: string) {
    await this.calendarService.deleteEvent(user.userId, eventId);
    return { success: true };
  }
}
