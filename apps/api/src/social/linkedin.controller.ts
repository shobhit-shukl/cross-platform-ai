import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateLinkedInPostDto } from './dto/create-linkedin-post.dto';
import { LinkedInService } from './linkedin.service';

class EditLinkedInPostDto {
  @IsString()
  @MinLength(1, { message: 'Post text is required' })
  @MaxLength(3000, { message: 'Post text must be 3000 characters or fewer' })
  commentary!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('api/linkedin')
export class LinkedInController {
  constructor(private readonly linkedInService: LinkedInService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.linkedInService.getProfile(user.userId);
    return { profile };
  }

  @Get('posts')
  async listPosts(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50) : undefined;
    const posts = await this.linkedInService.listPosts(user.userId, parsedLimit);
    return { posts };
  }

  @Post('posts')
  async createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLinkedInPostDto) {
    const post = await this.linkedInService.createPost(user.userId, dto);
    return { post };
  }

  @Patch('posts/:id')
  async editPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EditLinkedInPostDto,
  ) {
    const post = await this.linkedInService.editPost(user.userId, id, dto.commentary);
    return { post };
  }
}
