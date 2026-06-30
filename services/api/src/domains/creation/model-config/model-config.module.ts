import { Module } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { ModelConfigController } from './model-config.controller';
import { ModelConfigRepository } from './model-config.repository';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { MembershipModule } from '../../billing/membership/membership.module';

@Module({
  imports: [PrismaModule, AuthModule, MembershipModule],
  providers: [ModelConfigService, ModelConfigRepository],
  controllers: [ModelConfigController],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
