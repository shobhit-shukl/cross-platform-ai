import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Pinned deliberately rather than using the `gemini-flash-latest` alias: that alias
 * silently changes model behaviour, and during development it was returning 503 under
 * load while the pinned model was fine. Overridable via GEMINI_MODEL so a future
 * deprecation is an env change, not a code change — which is exactly how this project
 * hit a wall when gemini-2.5-flash became unavailable to new keys.
 */
const DEFAULT_MODEL = 'gemini-3.6-flash';

/** YouTube's hard limit is 100; leaving headroom keeps titles from being truncated mid-word. */
const MAX_TITLE_LENGTH = 90;
const MAX_DESCRIPTION_LENGTH = 4500;

const SYSTEM_INSTRUCTION = `You write metadata for YouTube videos.

Rules:
- title: at most ${MAX_TITLE_LENGTH} characters. Specific and compelling, not clickbait.
  Never use the characters < or >.
- description: 2-4 short paragraphs of plain text. Lead with what the video actually
  shows. End with 3-5 relevant hashtags on their own final line.
- Write in the same language the user's description is written in.
- Return only the requested fields. Do not add commentary.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['title', 'description'],
};

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export interface GeneratedVideoMetadata {
  title: string;
  description: string;
}

/** Mirrors the *ApiError classes in DriveUploadService/CalendarService — stable errorCode beside the status. */
class AiApiError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, errorCode, message }, status);
  }
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || undefined;
    this.model = this.configService.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
  }

  async generateVideoMetadata(prompt: string): Promise<GeneratedVideoMetadata> {
    if (!this.apiKey) {
      throw new AiApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'not_configured',
        'AI generation is not configured — set GEMINI_API_KEY in the API environment.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_BASE_URL}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
        },
      );
    } catch (err) {
      this.logger.warn(`Network error calling Gemini: ${(err as Error).message}`);
      throw new AiApiError(
        HttpStatus.BAD_GATEWAY,
        'network_error',
        'Could not reach the AI service. Please try again.',
      );
    }

    const data = (await response.json().catch(() => null)) as GeminiResponse | null;

    if (!response.ok) {
      throw this.toApiError(response.status, data);
    }

    // A safety filter can return 200 with no candidates at all.
    if (data?.promptFeedback?.blockReason) {
      throw new AiApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'blocked',
        'The AI declined to generate metadata for that description. Try rephrasing it.',
      );
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.warn(`Gemini returned no content (finishReason=${data?.candidates?.[0]?.finishReason})`);
      throw new AiApiError(
        HttpStatus.BAD_GATEWAY,
        'empty_response',
        'The AI returned an empty response. Please try again.',
      );
    }

    return this.parseAndSanitize(text);
  }

  /**
   * responseSchema makes well-formed JSON very likely but not guaranteed, and the model
   * can still overshoot the length limits stated in the prompt. The publish DTO rejects
   * titles over 100 chars or containing angle brackets, so enforce those here rather
   * than letting a generation succeed and the publish fail confusingly later.
   */
  private parseAndSanitize(text: string): GeneratedVideoMetadata {
    let parsed: { title?: unknown; description?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      this.logger.warn(`Gemini returned non-JSON despite responseSchema: ${text.slice(0, 200)}`);
      throw new AiApiError(
        HttpStatus.BAD_GATEWAY,
        'invalid_response',
        'The AI returned an unexpected format. Please try again.',
      );
    }

    const title = typeof parsed.title === 'string' ? parsed.title : '';
    const description = typeof parsed.description === 'string' ? parsed.description : '';

    if (!title.trim()) {
      throw new AiApiError(
        HttpStatus.BAD_GATEWAY,
        'invalid_response',
        'The AI did not return a usable title. Please try again.',
      );
    }

    return {
      title: title.replace(/[<>]/g, '').trim().slice(0, MAX_TITLE_LENGTH),
      description: description.trim().slice(0, MAX_DESCRIPTION_LENGTH),
    };
  }

  private toApiError(status: number, data: GeminiResponse | null): AiApiError {
    const message = data?.error?.message ?? 'The AI service returned an error.';
    this.logger.warn(`Gemini API error (${status}): ${message.slice(0, 200)}`);

    if (status === 429) {
      return new AiApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'quota_exceeded',
        'AI generation rate limit reached. Please wait a moment and try again.',
      );
    }
    if (status === 400 || status === 403) {
      return new AiApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'not_configured',
        'The AI service rejected the request — the API key may be invalid or lack access.',
      );
    }
    if (status === 404) {
      // Exactly what happened with gemini-2.5-flash: the model was retired for new keys.
      return new AiApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'model_unavailable',
        `The configured AI model (${this.model}) is unavailable. Set GEMINI_MODEL to a current model.`,
      );
    }
    return new AiApiError(
      HttpStatus.BAD_GATEWAY,
      'network_error',
      'The AI service is temporarily unavailable. Please try again.',
    );
  }
}
