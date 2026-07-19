import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { SessionRepository } from './session.repository';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) { }

  async findUserSessions(userId: string) {
    return this.sessionRepository.findUserSessions(userId);
  }

  async revokeSession(sessionId: string, currentUserId: string, currentSessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'session.not_found');
    if (session.userId !== currentUserId) throw new I18nHttpException(HttpStatus.FORBIDDEN, 'session.forbidden');
    await this.sessionRepository.delete(sessionId);
    return { message: '设备已退出登录' };
  }

  async revokeAllSessions(userId: string, currentSessionId: string) {
    // 保留当前 session
    await this.sessionRepository.deleteAllExcept(userId, currentSessionId);
    return { message: '其他设备已全部退出登录' };
  }
}
