import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GenerateMetadataDto } from './dto/generate-metadata.dto';
import { GeminiService } from './gemini.service';

@UseGuards(JwtAuthGuard)
@Controller('api/ai')
export class AiController {
  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Rate-limited more tightly than the global default: each call costs real Gemini
   * quota, and a user hammering "Generate" could exhaust the shared project key for
   * everyone else.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('video-metadata')
  async generateVideoMetadata(@Body() dto: GenerateMetadataDto) {
    const metadata = await this.geminiService.generateVideoMetadata(dto.prompt);
    return { metadata };
  }
}
