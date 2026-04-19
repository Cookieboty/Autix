import { Module } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { ModelConfigController } from './model-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ModelConfigService],
  controllers: [ModelConfigController],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
