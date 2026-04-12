import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
