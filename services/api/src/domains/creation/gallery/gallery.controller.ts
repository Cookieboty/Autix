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

/** 用户侧广场投稿接口（先审后发）。热度 Feed 列表见后续任务，本控制器不含 GET /gallery/feed。 */
@Controller('gallery')
export class GalleryController {
  constructor(
    private readonly service: GalleryService,
    private readonly metrics: ResourceMetricsService,
  ) {}

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

  @Public()
  @Get(':id')
  getVisible(@OptionalCurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.getVisible(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.like(getCurrentUserId(user), ResourceType.GALLERY_POST, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.unlike(getCurrentUserId(user), ResourceType.GALLERY_POST, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  favorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.favorite(getCurrentUserId(user), ResourceType.GALLERY_POST, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/favorite')
  unfavorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.unfavorite(getCurrentUserId(user), ResourceType.GALLERY_POST, id);
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
