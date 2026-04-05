import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async findUserSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        deviceName: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSession(sessionId: string, currentUserId: string, currentSessionId: string) {
    const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session 不存在');
    if (session.userId !== currentUserId) throw new ForbiddenException('无权操作');
    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { message: '设备已退出登录' };
  }

  async revokeAllSessions(userId: string, currentSessionId: string) {
    // 保留当前 session
    await this.prisma.userSession.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });
    return { message: '其他设备已全部退出登录' };
  }
}
