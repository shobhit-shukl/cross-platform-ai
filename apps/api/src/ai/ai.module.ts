import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { GeminiService } from './gemini.service';

/**
 * Platform-agnostic AI helpers. Deliberately its own module rather than living inside
 * SocialModule: nothing here is tied to a connected account or OAuth token, and the
 * same GeminiService will back LinkedIn post drafting and per-platform rewriting later.
 */
@Module({
  imports: [AuthModule], // for JwtAuthGuard
  controllers: [AiController],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class AiModule {}
