import { Module } from '@nestjs/common';
import { ChatDashboardController } from './chat-dashboard.controller';
import { ChatDashboardRepository } from './chat-dashboard.repository';
import { ChatDashboardService } from './chat-dashboard.service';

@Module({
  controllers: [ChatDashboardController],
  providers: [ChatDashboardRepository, ChatDashboardService],
})
export class ChatDashboardModule {}
