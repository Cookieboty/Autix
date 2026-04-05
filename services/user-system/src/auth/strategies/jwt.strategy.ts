import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthUser } from '@repo/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session) throw new UnauthorizedException('Session revoked');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User disabled');
    }

    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code),
        ),
      ),
    ];
    const roles = user.roles.map((ur) => ur.role.code);

    await this.prisma.userSession.update({
      where: { id: payload.sessionId },
      data: { lastActiveAt: new Date() },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      realName: user.realName ?? undefined,
      avatar: user.avatar ?? undefined,
      departmentId: user.departmentId ?? undefined,
      permissions,
      roles,
      sessionId: payload.sessionId,
    };
  }
}
