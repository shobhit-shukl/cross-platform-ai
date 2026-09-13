import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlink } from 'fs';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import type { Express } from 'express';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PublishFacebookVideoDto } from './dto/publish-facebook-video.dto';
import { FacebookService } from './facebook.service';
import { MAX_VIDEO_SIZE_BYTES } from './video-file-validator';

const UPLOAD_TEMP_DIR = join(tmpdir(), 'crosspost-uploads');
if (!existsSync(UPLOAD_TEMP_DIR)) {
  mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller('api/facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Post('publish')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: UPLOAD_TEMP_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: MAX_VIDEO_SIZE_BYTES },
    }),
  )
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    // Deliberately untyped (see YouTubePublishController for why): validated below so a
    // failure can unlink the temp file multer already wrote, instead of leaking it.
    @Body() rawBody: Record<string, unknown>,
  ) {
    if (!file) {
      throw new BadRequestException('A video file is required');
    }

    const dto = plainToInstance(PublishFacebookVideoDto, rawBody);
    const errors = await validate(dto);
    if (errors.length > 0) {
      unlink(file.path, () => {});
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(messages.length > 0 ? messages : 'Invalid request');
    }

    const post = await this.facebookService.publishVideo(user.userId, dto, { path: file.path, size: file.size });
    return { post };
  }

  @Get('videos')
  async listVideos(
    @CurrentUser() user: AuthenticatedUser,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 24, 1), 50) : undefined;
    const result = await this.facebookService.listVideos(user.userId, { after, limit: parsedLimit });
    return result;
  }
}
