import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@autix/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

export function getCurrentUserId(user: AuthUser): string {
  return user.id;
}
