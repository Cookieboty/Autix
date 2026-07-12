import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

type CreateSessionInput = {
  userId: string;
  refreshToken: string;
  ip: string;
  userAgent: string;
  expiresAt: Date;
  currentSystemId?: string;
};

type RotateRefreshTokenInput = {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
};

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSessionInput) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM "users" WHERE "id" = ${input.userId} FOR UPDATE
      `;
      if (!users[0] || !['ACTIVE', 'PENDING'].includes(users[0].status)) {
        throw new UnauthorizedException('账户不可用');
      }
      const session = await tx.userSession.create({
        data: {
          userId: input.userId,
          refreshToken: input.refreshToken,
          ip: input.ip,
          userAgent: input.userAgent,
          expiresAt: input.expiresAt,
          currentSystemId: input.currentSystemId,
        },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: { lastLoginAt: new Date() },
      });
      return session;
    });
  }

  findByRefreshToken(refreshToken: string) {
    return this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
  }

  findById(sessionId: string | undefined) {
    return this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
  }

  findJwtSession(sessionId: string) {
    return this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
  }

  rotateRefreshToken(input: RotateRefreshTokenInput) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT u."status"
        FROM "users" u
        JOIN "user_sessions" s ON s."userId" = u."id"
        WHERE s."id" = ${input.sessionId}
        FOR UPDATE OF u
      `;
      if (!users[0] || !['ACTIVE', 'PENDING'].includes(users[0].status)) {
        throw new UnauthorizedException('账户不可用');
      }
      return tx.userSession.update({
        where: { id: input.sessionId },
        data: {
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt,
        },
      });
    });
  }

  updateCurrentSystem(sessionId: string | undefined, currentSystemId: string) {
    return this.prisma.userSession.update({
      where: { id: sessionId },
      data: { currentSystemId },
    });
  }

  deleteAllForUser(userId: string) {
    return this.prisma.userSession.deleteMany({ where: { userId } });
  }

  deleteAllForUserExcept(userId: string, keepSessionId: string) {
    return this.prisma.userSession.deleteMany({
      where: { userId, NOT: { id: keepSessionId } },
    });
  }

  delete(sessionId: string): Promise<void> {
    return this.prisma.userSession
      .delete({ where: { id: sessionId } })
      .then(() => undefined);
  }
}
