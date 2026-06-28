import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './domains/platform/common/response.interceptor';
import { AllExceptionsFilter } from './domains/platform/common/all-exceptions.filter';
import { I18nService } from './domains/platform/i18n/i18n.service';

function captureStripeRawBody(req: unknown, _res: unknown, buf: Buffer) {
  const request = req as { originalUrl?: string; rawBody?: Buffer };
  if (request.originalUrl?.includes('/api/payments/webhooks/stripe')) {
    request.rawBody = Buffer.from(buf);
  }
}

async function bootstrap() {
  // Long AI calls (image/video generation) can take many minutes. Make our
  // per-request AbortSignal the single timeout authority by disabling Node's
  // global fetch (undici) default headersTimeout/bodyTimeout (~5min), which
  // would otherwise abort slow-but-valid generations before our 10min limit.
  // No-op on Bun (prod) / when undici isn't resolvable.
  try {
    const { setGlobalDispatcher, Agent } = await import('undici');
    setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));
  } catch {
    /* undici unavailable or Bun runtime — nothing to configure */
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'internal/{*splat}', method: RequestMethod.ALL }],
  });
  app.use(json({ limit: '15mb', verify: captureStripeRawBody }));
  app.use(urlencoded({ limit: '15mb', extended: true, verify: captureStripeRawBody }));
  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
      : { origin: 'http://localhost:3000', credentials: true },
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const i18n = app.get(I18nService);
  app.useGlobalInterceptors(new ResponseInterceptor(i18n));
  app.useGlobalFilters(new AllExceptionsFilter(i18n));

  app.enableShutdownHooks();

  const server = await app.listen(process.env.PORT ?? 4000);
  server.timeout = 0;
  server.keepAliveTimeout = 65_000;
  console.log(`API service running on http://localhost:${process.env.PORT ?? 4000}`);
}
bootstrap();
