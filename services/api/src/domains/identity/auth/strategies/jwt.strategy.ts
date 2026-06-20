import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthUser } from '@autix/domain';
import { AuthIdentityRepository } from '../auth-identity.repository';
import { AuthSessionRepository } from '../auth-session.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authIdentityRepository: AuthIdentityRepository,
    private readonly authSessionRepository: AuthSessionRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const session = await this.authSessionRepository.findJwtSession(
      payload.sessionId,
    );
    if (!session) throw new UnauthorizedException('Session revoked');
    if (!session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const currentSystemId = session.currentSystemId ?? undefined;

    const user = await this.authIdentityRepository.findAuthUserById(
      payload.sub,
      currentSystemId,
    );
    if (!user || user.status === 'DISABLED' || user.status === 'LOCKED') {
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

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      realName: user.realName ?? undefined,
      avatar: user.avatar ?? undefined,
      language: user.language ?? undefined,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      currentSystemId,
      permissions,
      roles,
      sessionId: payload.sessionId,
    };
  }
}
