import { Module } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { ArenaController } from './arena.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ModelConfigModule } from '../model-config/model-config.module';

@Module({
  imports: [PrismaModule, ModelConfigModule],
  providers: [ArenaService],
  controllers: [ArenaController],
  exports: [ArenaService],
})
export class ArenaModule {}
