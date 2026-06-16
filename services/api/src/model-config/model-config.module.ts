import { Module } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { ModelConfigController } from './model-config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [PrismaModule, AuthModule, SystemSettingsModule],
  providers: [ModelConfigService],
  controllers: [ModelConfigController],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
