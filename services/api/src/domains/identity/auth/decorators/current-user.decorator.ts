import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@autix/domain';

type RequestWithUser = {
  user?: AuthUser;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user as AuthUser;
  },
);

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

export function getCurrentUserId(user: AuthUser): string {
  return user.id;
}
