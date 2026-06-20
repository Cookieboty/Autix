import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { JwtPayload, TokenPair } from '@autix/domain';

@Injectable()
export class AuthTokenFactory {
  readonly accessTokenTtlSeconds = this.parseDurationSeconds(
    process.env.JWT_ACCESS_EXPIRES_IN,
    24 * 60 * 60,
  );

  readonly refreshTokenTtlMs =
    this.parseDurationSeconds(process.env.JWT_REFRESH_EXPIRES_IN, 30 * 24 * 60 * 60) *
    1000;

  constructor(private readonly jwtService: JwtService) {}

  createAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  createRefreshToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  createRefreshExpiresAt(now = Date.now()): Date {
    return new Date(now + this.refreshTokenTtlMs);
  }

  createTokenPair(payload: JwtPayload, refreshToken: string): TokenPair {
    return {
      accessToken: this.createAccessToken(payload),
      refreshToken,
      expiresIn: this.accessTokenTtlSeconds,
    };
  }

  private parseDurationSeconds(value: string | undefined, fallbackSeconds: number): number {
    if (!value) return fallbackSeconds;
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);

    const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
    if (!match) return fallbackSeconds;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;

    const multipliers: Record<string, number> = {
      ms: 1 / 1000,
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };
    return Math.max(1, Math.floor(amount * multipliers[unit]));
  }
}
