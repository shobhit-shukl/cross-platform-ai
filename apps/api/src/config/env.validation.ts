import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // The canonical frontend URL. OAuth callbacks redirect here, so it must be a single
  // URL, not a list.
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Optional, comma-separated extra origins allowed through CORS — e.g. Vercel's
  // per-deployment hostnames. Exact matches only; see main.ts for why no wildcards.
  ALLOWED_ORIGINS: z.string().optional(),
  API_URL: z.string().url().default('http://localhost:5000'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  OAUTH_STATE_SECRET: z
    .string()
    .min(32, 'OAUTH_STATE_SECRET must be at least 32 characters'),

  // AES-256-GCM key, 32 raw bytes encoded as 64 hex chars.
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),

  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url(),

  // Same Google Cloud OAuth client as GOOGLE_CLIENT_ID/SECRET above — Drive just needs
  // its own registered redirect URI, since Google validates that per-flow.
  GOOGLE_DRIVE_REDIRECT_URI: z.string().url(),

  // Same OAuth client again, its own registered redirect URI for Calendar.
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url(),

  // A separate OAuth vendor entirely — LinkedIn, not Google. Its own app registration,
  // its own client id/secret. Deliberately OPTIONAL (unlike the required GOOGLE_*
  // vars): the app must still boot — and YouTube/Drive/Calendar must still work —
  // before a LinkedIn Developer app exists. LinkedInProvider checks these itself at
  // request time and fails with a clear, specific message if they're missing, instead
  // of the whole API refusing to start over one unconfigured integration.
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().url().optional(),

  // Google Gemini (Generative Language API). Distinct from the GOOGLE_* OAuth
  // credentials: an API key identifies the project and only works for APIs that accept
  // one. YouTube/Drive/Calendar reject API keys outright since they act on a specific
  // user's data. Optional, like the LinkedIn vars — the app boots without it and AI
  // features are simply unavailable rather than crashing the whole API.
  GEMINI_API_KEY: z.string().optional(),

  // Overrides the pinned default in GeminiService. Google retires models periodically
  // (gemini-2.5-flash stopped accepting new keys), so this makes recovery an env change
  // rather than a redeploy of new code.
  GEMINI_MODEL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `\n\nInvalid environment configuration. Fix apps/api/.env and restart:\n${issues}\n`,
    );
  }
  return parsed.data;
}
