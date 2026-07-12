import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { ResourceType } from '../../platform/prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import {
  CurrentUser,
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { ResourceMetricsService } from '../../platform/resource-metrics/resource-metrics.service';
import { GalleryService } from './gallery.service';
import { CreateGalleryPostDto } from './dto/create-gallery-post.dto';
import { CreateGalleryDraftDto } from './dto/create-gallery-draft.dto';
import { UpdateGalleryPostDto } from './dto/update-gallery-post.dto';
import { CreateGalleryReportDto } from './dto/create-report.dto';

/** 用户侧广场投稿接口（先审后发）+ 公开热度 Feed（GET /gallery/feed，供首页图片/视频画廊消费）。 */
@Controller('gallery')
export class GalleryController {
  constructor(
    private readonly service: GalleryService,
    private readonly metrics: ResourceMetricsService,
  ) {}

  /**
   * 公开热度 Feed：kind=IMAGE|VIDEO 分流，只返回 PUBLISHED 作品。
   * 注意：必须声明在 GET :id 之前，否则 /gallery/feed 会被 :id 路由吞掉。
   */
  @Public()
  @Get('feed')
  feed(
    @Query('kind') kind?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listFeed(kind, cursor, limit ? Number(limit) : 24);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createSubmission(@CurrentUser() user: AuthUser, @Body() body: CreateGalleryPostDto) {
    return this.service.createSubmission(getCurrentUserId(user), body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('drafts')
  createDraft(@CurrentUser() user: AuthUser, @Body() body: CreateGalleryDraftDto) {
    return this.service.createDraft(getCurrentUserId(user), body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('drafts/:id')
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateGalleryPostDto,
  ) {
    return this.service.updateDraft(getCurrentUserId(user), id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  submitDraft(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.submitDraft(getCurrentUserId(user), id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updatePost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateGalleryPostDto,
  ) {
    return this.service.updatePost(getCurrentUserId(user), id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  removePost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removePost(getCurrentUserId(user), id);
  }

  /** 作者本人自行下架已发布作品，PUBLISHED → UNPUBLISHED。 */
  @UseGuards(JwtAuthGuard)
  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.unpublish(getCurrentUserId(user), id);
  }

  /** 作者本人把已下架作品重新提交审核，UNPUBLISHED → PENDING（拒绝 HIDDEN，防逃避处罚）。 */
  @UseGuards(JwtAuthGuard)
  @Post(':id/republish')
  republish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.republish(getCurrentUserId(user), id);
  }

  @Public()
  @Get(':id')
  getVisible(@OptionalCurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.getVisible(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.like(getCurrentUserId(user), id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.unlike(getCurrentUserId(user), ResourceType.GALLERY_POST, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  favorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.favorite(getCurrentUserId(user), id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/favorite')
  unfavorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.unfavorite(getCurrentUserId(user), ResourceType.GALLERY_POST, id);
  }

  /** 仅已发布作品可下载；同步事务记一次下载事件 + INCR downloadCount，返回下载 URL。 */
  @UseGuards(JwtAuthGuard)
  @Post(':id/download')
  download(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.download(getCurrentUserId(user), id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CreateGalleryReportDto,
  ) {
    return this.service.report(getCurrentUserId(user), id, body);
  }
}
