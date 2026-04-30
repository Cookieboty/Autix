import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join, dirname } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { I18nService } from './i18n/i18n.service';
import { USER_GRPC_PACKAGE } from '@autix/contracts';

const USER_PROTO_PATH = join(
  dirname(require.resolve('@autix/contracts/package.json')),
  'proto/user.proto',
);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(helmet());

  const corsOrigin = process.env.USER_CORS_ORIGIN;
  app.enableCors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
      : undefined,
  );

  const i18n = app.get(I18nService);
  app.useGlobalInterceptors(new ResponseInterceptor(i18n));
  app.useGlobalFilters(new AllExceptionsFilter(i18n));

  app.enableShutdownHooks();

  const grpcHost = process.env.GRPC_HOST ?? '127.0.0.1';
  const grpcPort = process.env.GRPC_PORT ?? '50051';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: USER_GRPC_PACKAGE,
      protoPath: USER_PROTO_PATH,
      url: `${grpcHost}:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4002);
  console.log(`User System running on port ${process.env.PORT ?? 4002}`);
  console.log(`gRPC server running on port ${grpcPort}`);
}
bootstrap();
