import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import type { AuthUser } from '@autix/domain';
import { AuthIdentityRepository } from './auth-identity.repository';

/**
 * FIX-20: 与会员服务的过期判定对齐——会员在 `expiresAt <= now` 时即视为过期（非生效）。
 * 旧实现用严格 `<`，在恰好到期的一刻与服务层不一致。
 */
export function isMembershipActiveAt(
  membership: { status: string; expiresAt: Date } | null,
  now: Date,
): boolean {
  return Boolean(membership) && membership!.status === 'ACTIVE' && membership!.expiresAt > now;
}

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly authIdentityRepository: AuthIdentityRepository) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('未登录');

    const membership = await this.authIdentityRepository.findMembershipByUserId(
      userId,
    );

    if (!isMembershipActiveAt(membership, new Date())) {
      throw new ForbiddenException('该功能需要开通会员');
    }

    return true;
  }
}
