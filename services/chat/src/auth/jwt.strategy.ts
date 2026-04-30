import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRpcService } from './user-rpc.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userRpc: UserRpcService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid token: missing sessionId');
    }

    const result = await this.userRpc.validateSession(payload.sessionId);
    if (!result.valid) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      sessionId: payload.sessionId,
    };
  }
}
