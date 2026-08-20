import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import type { Express } from 'express';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DriveUploadService } from './drive-upload.service';

const MAX_DRIVE_FILE_SIZE_BYTES = 100 * 1024 * 1024; // generous for AI-generated docs/images; not video-sized
const UPLOAD_TEMP_DIR = join(tmpdir(), 'crosspost-drive-uploads');
if (!existsSync(UPLOAD_TEMP_DIR)) {
  mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller('api/drive')
export class DriveUploadController {
  constructor(private readonly driveUploadService: DriveUploadService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_TEMP_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: MAX_DRIVE_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() rawBody: Record<string, unknown>,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }

    const fileName =
      typeof rawBody?.fileName === 'string' && rawBody.fileName.trim().length > 0
        ? rawBody.fileName.trim().slice(0, 255)
        : undefined;

    const result = await this.driveUploadService.uploadFile(
      user.userId,
      { path: file.path, size: file.size, originalname: file.originalname, mimetype: file.mimetype },
      fileName,
    );

    return { file: result };
  }

  @Get('files')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('pageToken') pageToken?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100) : undefined;
    return this.driveUploadService.listFiles(user.userId, { pageToken, limit: parsedLimit });
  }

  @Delete('files/:fileId')
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('fileId') fileId: string) {
    await this.driveUploadService.deleteFile(user.userId, fileId);
    return { success: true };
  }
}
