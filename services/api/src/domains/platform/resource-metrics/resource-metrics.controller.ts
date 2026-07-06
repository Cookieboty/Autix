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
    return this.service.unfavorite(userId, type, id);
  }

  // 分享无需登录（也不记录是谁分享的），与 public-growth 的 recordShare 同类行为。
  @Public()
  @Post(':type/:id/share')
  @HttpCode(HttpStatus.OK)
  share(@Param('type') typeStr: string, @Param('id') id: string) {
    const type = parseResourceType(typeStr);
    return this.service.share(type, id);
  }
}
