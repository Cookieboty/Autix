import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('未登录');
    }

    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    if (
      user.isSuperAdmin ||
      roles.includes('SYSTEM_ADMIN') ||
      roles.includes('ADMIN') ||
      roles.includes('SUPER_ADMIN') ||
      permissions.includes('admin:access') ||
      permissions.includes('system:admin')
    ) {
      return true;
    }

    throw new ForbiddenException('需要管理员权限');
  }
}
