import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { I18nService } from './i18n/i18n.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3002' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const i18n = app.get(I18nService);
  app.useGlobalInterceptors(new ResponseInterceptor(i18n));
  app.useGlobalFilters(new AllExceptionsFilter(i18n));

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4001);
  console.log(`Chat service running on http://localhost:${process.env.PORT ?? 4001}`);
}
bootstrap();
