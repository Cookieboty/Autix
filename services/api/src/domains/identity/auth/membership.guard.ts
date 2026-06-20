import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { AuthUser } from '@autix/types';

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('未登录');

    const membership = await this.prisma.user_memberships.findUnique({
      where: { userId },
    });

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
