import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRpcService } from './user-rpc.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private userRpc: UserRpcService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    if (!userId) throw new ForbiddenException('未登录');

    try {
      const result = await this.userRpc.checkAdmin(userId);
      if (result.isAdmin) return true;
    } catch {
      throw new ForbiddenException('管理员验证服务不可用');
    }

    throw new ForbiddenException('需要管理员权限');
  }
}
