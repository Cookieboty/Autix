import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join, dirname } from 'path';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { USER_GRPC_PACKAGE } from '@autix/contracts';

const USER_PROTO_PATH = join(
  dirname(require.resolve('@autix/contracts/package.json')),
  'proto/user.proto',
);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const grpcPort = process.env.GRPC_PORT ?? '50051';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: USER_GRPC_PACKAGE,
      protoPath: USER_PROTO_PATH,
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4002);
  console.log(`User System running on port ${process.env.PORT ?? 4002}`);
  console.log(`gRPC server running on port ${grpcPort}`);
}
bootstrap();
