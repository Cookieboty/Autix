import { Module } from '@nestjs/common';
import { UserGrpcController } from './user-grpc.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RegistrationModule } from '../registration/registration.module';

@Module({
  imports: [PrismaModule, RegistrationModule],
  controllers: [UserGrpcController],
})
export class GrpcModule {}
