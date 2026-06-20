import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { PointsModule } from '../points/points.module';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';

@Module({
  imports: [PrismaModule, PointsModule, forwardRef(() => AuthModule)],
  controllers: [InviteController],
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}
