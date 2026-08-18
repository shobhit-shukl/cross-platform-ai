import {
  BadRequestException,
  Body,
  Controller,
  Post,
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
import { PublishVideoDto } from './dto/publish-video.dto';
import { PublishingService } from './publishing.service';
import { MAX_VIDEO_SIZE_BYTES } from './video-file-validator';

const UPLOAD_TEMP_DIR = join(tmpdir(), 'crosspost-uploads');
if (!existsSync(UPLOAD_TEMP_DIR)) {
  mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller('api/youtube')
export class YouTubePublishController {
  constructor(private readonly publishingService: PublishingService) {}

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
    // Deliberately untyped here (not `PublishVideoDto`) so the global ValidationPipe's
    // automatic transform/validate is skipped — it runs on a plain object, before we've
    // had a chance to clean up the file multer already wrote to disk. Validated below
    // instead, where a failure can unlink the temp file rather than leak it.
    @Body() rawBody: Record<string, unknown>,
  ) {
    if (!file) {
      throw new BadRequestException('A video file is required');
    }

    const dto = plainToInstance(PublishVideoDto, rawBody);
    const errors = await validate(dto);
    if (errors.length > 0) {
      unlink(file.path, () => {});
      const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(messages.length > 0 ? messages : 'Invalid request');
    }

    const job = await this.publishingService.createJob(user.userId, dto, {
      path: file.path,
      size: file.size,
      originalname: file.originalname,
    });

    return { job };
  }
}
