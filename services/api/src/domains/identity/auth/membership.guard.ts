import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import type { AuthUser } from '@autix/domain';
import { AuthIdentityRepository } from './auth-identity.repository';

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

    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.expiresAt < new Date()
    ) {
      throw new ForbiddenException('该功能需要开通会员');
    }

    return true;
  }
}
