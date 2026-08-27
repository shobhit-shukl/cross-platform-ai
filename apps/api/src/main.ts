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

  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL'),
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
