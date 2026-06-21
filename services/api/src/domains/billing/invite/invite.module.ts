import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../points/points.module';
import { SystemSettingsModule } from '../../platform/system-settings/system-settings.module';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { InviteRepository } from './invite.repository';

@Module({
  imports: [PrismaModule, PointsModule, SystemSettingsModule, forwardRef(() => AuthModule)],
  controllers: [InviteController],
  providers: [InviteService, InviteRepository],
  exports: [InviteService],
})
export class InviteModule {}
