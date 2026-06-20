import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { SystemRepository } from './system.repository';

@Module({
  controllers: [SystemController],
  providers: [SystemRepository, SystemService],
  exports: [SystemService],
})
export class SystemModule {}
