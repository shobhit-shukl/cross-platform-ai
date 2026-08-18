import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Platform } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SocialAccountsService } from './social-accounts.service';

/** Maps the URL segment (e.g. "youtube") to the Platform enum. Extend when IG/FB ship. */
function parsePlatform(value: string): Platform {
  const normalized = value.toUpperCase();
  if (normalized in Platform) {
    return Platform[normalized as keyof typeof Platform];
  }
  throw new BadRequestException(`Unsupported platform "${value}"`);
}

@UseGuards(JwtAuthGuard)
@Controller('api/social-accounts')
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const accounts = await this.socialAccountsService.listForUser(user.userId);
    return { accounts };
  }

  @Delete(':platform/:id')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platformParam: string,
    @Param('id') id: string,
  ) {
    const platform = parsePlatform(platformParam);
    await this.socialAccountsService.disconnect(user.userId, platform, id);
    return { success: true };
  }
}
