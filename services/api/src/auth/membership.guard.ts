import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const userId = (req.user as any)?.userId;
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
