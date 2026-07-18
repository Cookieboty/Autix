import { Controller, Get, Param, Query } from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { OptionalCurrentUser } from '../../identity/auth/decorators/current-user.decorator';
import { PublicProfileService } from './public-profile.service';

/**
 * `/@username` 公开个人页后端契约。
 * - `GET /profiles/:username`            → 公开 profile（匿名可读）
 * - `GET /profiles/:username/generations`→ 该用户已发布作品 feed（匿名可读；登录态附 liked/favorited）
 *
 * 前端虚荣链接 `/@handle` 由 web proxy 改写到物理路由，真正打的是这两个端点。
 */
@Controller('profiles')
export class PublicProfileController {
  constructor(private readonly service: PublicProfileService) {}

  @Public()
  @Get(':username')
  getProfile(@Param('username') username: string) {
    return this.service.getByUsername(username);
  }

  @Public()
  @Get(':username/generations')
  getGenerations(
    @OptionalCurrentUser() user: AuthUser | undefined,
    @Param('username') username: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getGenerations(username, cursor, limit ? Number(limit) : 24, user);
  }
}
