import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { SessionRepository } from './session.repository';

@Module({
  controllers: [SessionController],
  providers: [SessionRepository, SessionService],
})
export class SessionModule {}
