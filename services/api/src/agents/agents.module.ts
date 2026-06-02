import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { AgentsService } from './agents.service';
import { AgentsController, AgentsAdminController } from './agents.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [AgentsController, AgentsAdminController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
