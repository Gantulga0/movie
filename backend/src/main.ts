import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on http://localhost:${port}/api`);

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
