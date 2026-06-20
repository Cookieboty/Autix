import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { MessageRepository } from './message.repository';

@Module({
  imports: [PrismaModule],
  providers: [MessageService, MessageRepository],
  exports: [MessageService],
})
export class MessageModule {}
