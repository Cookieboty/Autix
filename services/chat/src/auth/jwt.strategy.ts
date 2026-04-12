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
        if (match) return match[1];

        // 3. Query parameter (用于 SSE 等场景)
        const queryToken = req.query.token;
        if (typeof queryToken === 'string') return queryToken;

        return null;
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
