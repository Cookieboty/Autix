import { Module } from '@nestjs/common';
import { UserGrpcController } from './user-grpc.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserGrpcController],
})
export class GrpcModule {}
