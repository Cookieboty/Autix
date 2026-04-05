import { Controller, Get, Delete, Param } from '@nestjs/common';
import { SessionService } from './session.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@repo/types';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.sessionService.findUserSessions(user.id);
  }

  @Delete('all')
  revokeAll(@CurrentUser() user: AuthUser) {
    return this.sessionService.revokeAllSessions(user.id, user.sessionId!);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessionService.revokeSession(id, user.id, user.sessionId!);
  }
}
