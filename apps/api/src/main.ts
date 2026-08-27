import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Behind a hosting proxy (Render, Fly, etc.) every request arrives from the load
  // balancer's IP. Without this, ThrottlerGuard rate-limits by that single shared IP —
  // meaning one busy user could lock out everyone else. Trusting the proxy makes
  // req.ip resolve to the real client via X-Forwarded-For. Only enabled in production;
  // locally there's no proxy and trusting a spoofable header would be a downgrade.
  if (configService.get('NODE_ENV') === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());

  // FRONTEND_URL stays a single canonical URL — OAuth callbacks redirect to it, so it
  // can't be a list. CORS needs to be slightly broader: Vercel gives every deployment
  // its own hostname (cross-platform-<hash>-<team>.vercel.app), so opening a specific
  // build from the Vercel dashboard would otherwise be blocked even though it's the
  // same app.
  //
  // ALLOWED_ORIGINS (optional, comma-separated) covers those extra hostnames. It is a
  // strict allowlist of exact origins — deliberately NOT a wildcard like
  // "*.vercel.app", which would let any Vercel-hosted site call this API with the
  // user's credentials attached, since credentials:true is on.
  const canonicalOrigin = configService.get<string>('FRONTEND_URL');
  const extraOrigins = (configService.get<string>('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([canonicalOrigin, ...extraOrigins].filter(Boolean) as string[]);

  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header: same-origin navigations, curl, server-to-server. Not a
      // browser cross-site request, so there's nothing for CORS to protect against.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('PORT')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`CrossPost AI API listening on http://localhost:${port}`);
}

bootstrap();
