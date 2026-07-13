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
 * 拥有专属受守卫路由的资源类型：这些类型的 like/favorite 写路径**必须**走各自的
 * 专属端点，那里才有存在性/可见性校验：
 *   - GALLERY_POST      → /gallery/:id/like|favorite（仅 PUBLISHED）
 *   - IMAGE_TEMPLATE    → /marketplace/image-templates/:id/favorite（公开可见守卫，Plan B Task 5）
 *   - VIDEO_TEMPLATE    → /marketplace/video-templates/:id/favorite（同上）
 * 走通用 /resources/:type/:id/like|favorite 会绕过这些守卫，允许对不存在/未过审/
 * DRAFT/HIDDEN/SYSTEM 的资源留下孤立/被放大的指标行。
 *
 * 安全修复（Plan C Task 10 复审）：Plan C Task 10 把模板 favoriteCount 展示改读
 * resource_metrics（正是本通用端点写入的表），使该越权从"孤立指标"升级为"可对
 * 非 APPROVED / SYSTEM 模板刷高展示计数"的实时漏洞。原 assertNotGalleryWrite 只挡
 * GALLERY_POST，故扩展为 assertNotDedicatedResource，同样拦下两类模板。
 *
 * SKILL/MCP/AGENT 无专属可见性守卫、本就合法复用通用端点，继续放行。
 * 读路径（GET metrics）与 share（无专属分享路由，且仅计数）不受影响。
 */
const DEDICATED_ROUTE_RESOURCE_TYPES = new Set<ResourceType>([
  ResourceType.GALLERY_POST,
  ResourceType.IMAGE_TEMPLATE,
  ResourceType.VIDEO_TEMPLATE,
]);

function assertNotDedicatedResource(type: ResourceType): void {
  if (DEDICATED_ROUTE_RESOURCE_TYPES.has(type)) {
    throw new BadRequestException(
      `${type} 互动请走其专属端点（/gallery|/marketplace/image-templates|/marketplace/video-templates 的 :id/like|favorite）`,
    );
  }
}

/**
 * P1-1：share 为公开、无专属分享路由的纯计数写入，仅沿用原 GALLERY_POST 拦截
 * （gallery 分享另有其入口），不扩展到模板——模板没有替代分享路由，扩展会直接
 * 断掉模板分享功能。
 */
function assertNotGalleryShare(type: ResourceType): void {
  if (type === ResourceType.GALLERY_POST) {
    throw new BadRequestException('gallery 互动请走 /gallery 专属端点');
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
    assertNotDedicatedResource(type);
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
    assertNotDedicatedResource(type);
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
    assertNotDedicatedResource(type);
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
    assertNotDedicatedResource(type);
    return this.service.unfavorite(userId, type, id);
  }

  // 分享无需登录（也不记录是谁分享的），与 public-growth 的 recordShare 同类行为。
  @Public()
  @Post(':type/:id/share')
  @HttpCode(HttpStatus.OK)
  share(@Param('type') typeStr: string, @Param('id') id: string) {
    const type = parseResourceType(typeStr);
    assertNotGalleryShare(type);
    return this.service.share(type, id);
  }
}
