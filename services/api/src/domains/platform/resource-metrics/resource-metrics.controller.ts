import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResourceType } from '../prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import {
  CurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { ResourceMetricsService } from './resource-metrics.service';
import type { AuthUser } from '@autix/domain';

function parseResourceType(typeStr: string): ResourceType {
  const type = (ResourceType as Record<string, ResourceType>)[typeStr];
  if (!type) {
    throw new BadRequestException(`不支持的资源类型: ${typeStr}`);
  }
  return type;
}

/**
 * P1-1：通用互动的写路径（like/favorite/share）禁止直接作用于 GALLERY_POST——
 * gallery.service.ts 在 /gallery/:id/like|favorite 前会先校验作品存在且 PUBLISHED，
 * 若走这条通用路径会绕过该校验，允许对不存在/DRAFT/HIDDEN 的作品留下孤立指标行。
 * 读路径（GET metrics）不受影响，仍对全部类型开放。
 */
function assertNotGalleryWrite(type: ResourceType): void {
  if (type === ResourceType.GALLERY_POST) {
    throw new BadRequestException('gallery 互动请走 /gallery/:id/like|favorite');
  }
}

@Controller('resources')
export class ResourceMetricsController {
  constructor(private readonly service: ResourceMetricsService) {}

  @Public()
  @Get(':type/:id/metrics')
  getMetrics(@Param('type') typeStr: string, @Param('id') id: string) {
    const type = parseResourceType(typeStr);
    return this.service.getMetrics(type, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':type/:id/like')
  like(
    @CurrentUser() user: AuthUser,
    @Param('type') typeStr: string,
    @Param('id') id: string,
  ) {
    const userId = getCurrentUserId(user);
    const type = parseResourceType(typeStr);
    assertNotGalleryWrite(type);
    return this.service.like(userId, type, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':type/:id/like')
  unlike(
    @CurrentUser() user: AuthUser,
    @Param('type') typeStr: string,
    @Param('id') id: string,
  ) {
    const userId = getCurrentUserId(user);
    const type = parseResourceType(typeStr);
    assertNotGalleryWrite(type);
    return this.service.unlike(userId, type, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':type/:id/favorite')
  favorite(
    @CurrentUser() user: AuthUser,
    @Param('type') typeStr: string,
    @Param('id') id: string,
  ) {
    const userId = getCurrentUserId(user);
    const type = parseResourceType(typeStr);
    assertNotGalleryWrite(type);
    return this.service.favorite(userId, type, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':type/:id/favorite')
  unfavorite(
    @CurrentUser() user: AuthUser,
    @Param('type') typeStr: string,
    @Param('id') id: string,
  ) {
    const userId = getCurrentUserId(user);
    const type = parseResourceType(typeStr);
    assertNotGalleryWrite(type);
    return this.service.unfavorite(userId, type, id);
  }

  // 分享无需登录（也不记录是谁分享的），与 public-growth 的 recordShare 同类行为。
  @Public()
  @Post(':type/:id/share')
  @HttpCode(HttpStatus.OK)
  share(@Param('type') typeStr: string, @Param('id') id: string) {
    const type = parseResourceType(typeStr);
    assertNotGalleryWrite(type);
    return this.service.share(type, id);
  }
}
