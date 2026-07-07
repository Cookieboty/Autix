import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * M4 修复：此前 `@Public()` 路由直接 `return true`，短路掉 `super.canActivate`，
   * 导致 passport 的 jwt 策略从不执行——即使带了合法 JWT，`request.user` 也不会被填充
   * （例如作者本人访问自己 DRAFT/PENDING 的 `GET /gallery/:id` 会被误判为不可见）。
   * 现在始终跑一遍 `super.canActivate`（会触发 jwt 策略解析 token），是否放行则交给
   * `handleRequest`：公开路由下"无 token / token 无效"不再阻断请求，只是 `request.user`
   * 为空；受保护路由维持原有的"无合法用户则 401"语义。
   */
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // best-effort：token 缺失/无效时不抛错，仅 request.user 为空。
      return (user || undefined) as TUser;
    }
    return super.handleRequest(err, user, info, context);
  }
}
