import { Injectable } from '@nestjs/common';
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
    return this.prisma.userSession.create({
      data: {
        userId: input.userId,
        refreshToken: input.refreshToken,
        ip: input.ip,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
        currentSystemId: input.currentSystemId,
      },
    });
  }

  findByRefreshToken(refreshToken: string) {
    return this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
  }

  rotateRefreshToken(input: RotateRefreshTokenInput) {
    return this.prisma.userSession.update({
      where: { id: input.sessionId },
      data: {
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
      },
    });
  }

  delete(sessionId: string): Promise<void> {
    return this.prisma.userSession
      .delete({ where: { id: sessionId } })
      .then(() => undefined);
  }
}
