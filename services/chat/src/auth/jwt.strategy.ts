import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => {
        // 1. Authorization: Bearer <token>
        const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (fromHeader) return fromHeader;

        // 2. Cookie 方式（用于 SSE 等无法设置 Header 的场景）
        const cookie = req.headers.cookie ?? '';
        const match = cookie.match(/accessToken=([^;]+)/);
        return match ? match[1] : null;
      },
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      username: payload.username,
      sessionId: payload.sessionId,
    };
  }
}
