import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody keeps the unparsed request buffer around so the wire.mn webhook
  // can verify its HMAC signature against the exact bytes wire signed.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);

  // Novel chapter bodies exceed Express's 100kb JSON default.
  app.useBodyParser('json', { limit: '2mb' });

  app.setGlobalPrefix('api');
  app.use(helmet());

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  Logger.log(`API running on port ${port} (prefix /api)`, 'Bootstrap');

  // Render free tier spins the service down after 15 min of no traffic;
  // self-ping every 10 min keeps it awake. RENDER_EXTERNAL_URL is set by Render.
  const externalUrl = config.get<string>('RENDER_EXTERNAL_URL');
  if (externalUrl) {
    setInterval(() => {
      fetch(`${externalUrl}/api/health`).catch(() => undefined);
    }, 10 * 60 * 1000);
  }
}

bootstrap();
