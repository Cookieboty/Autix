import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user?.id) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'auth.not_logged_in');
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

    throw new I18nHttpException(HttpStatus.FORBIDDEN, 'auth.admin_required');
  }
}
