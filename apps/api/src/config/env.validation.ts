import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
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
