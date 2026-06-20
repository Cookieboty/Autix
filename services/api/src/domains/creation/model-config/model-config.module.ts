import { Module } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { ModelConfigController } from './model-config.controller';
import { ModelConfigRepository } from './model-config.repository';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { SystemSettingsModule } from '../../platform/system-settings/system-settings.module';

@Module({
  imports: [PrismaModule, AuthModule, SystemSettingsModule],
  providers: [ModelConfigService, ModelConfigRepository],
  controllers: [ModelConfigController],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
