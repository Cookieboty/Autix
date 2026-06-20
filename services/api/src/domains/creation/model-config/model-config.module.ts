import { Module } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { ModelConfigController } from './model-config.controller';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { SystemSettingsModule } from '../../platform/system-settings/system-settings.module';

@Module({
  imports: [PrismaModule, AuthModule, SystemSettingsModule],
  providers: [ModelConfigService],
  controllers: [ModelConfigController],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
