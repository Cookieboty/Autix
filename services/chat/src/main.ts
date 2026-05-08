import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { I18nService } from './i18n/i18n.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'internal/{*splat}', method: RequestMethod.ALL }],
  });
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ limit: '15mb', extended: true }));
  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
      : { origin: 'http://localhost:3002', credentials: true },
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const i18n = app.get(I18nService);
  app.useGlobalInterceptors(new ResponseInterceptor(i18n));
  app.useGlobalFilters(new AllExceptionsFilter(i18n));

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4001);
  console.log(`Chat service running on http://localhost:${process.env.PORT ?? 4001}`);
}
bootstrap();
