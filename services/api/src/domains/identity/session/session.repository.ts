import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });
  }

  findById(sessionId: string) {
    return this.prisma.userSession.findUnique({ where: { id: sessionId } });
  }

  delete(sessionId: string) {
    return this.prisma.userSession.delete({ where: { id: sessionId } });
  }

  deleteAllExcept(userId: string, sessionId: string) {
    return this.prisma.userSession.deleteMany({
      where: { userId, id: { not: sessionId } },
    });
  }
}
