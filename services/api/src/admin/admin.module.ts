import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RegistrationModule } from '../registration/registration.module';

@Module({
  imports: [PrismaModule, AuthModule, RegistrationModule],
  controllers: [AdminController],
})
export class AdminModule {}
