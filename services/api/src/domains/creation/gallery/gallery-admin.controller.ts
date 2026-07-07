import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import {
  CurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { BatchJobService } from '../../admin/admin/batch-job.service';
import type { ResourcePayload } from '../../admin/admin/resource-migration.service';
import { ResourceType } from '../../platform/prisma/generated';
import { GalleryService } from './gallery.service';
import { RejectGalleryPostDto } from './dto/reject-post.dto';
import { ResolveGalleryReportDto } from './dto/resolve-report.dto';

/** 广场审核后台：待审列表 + 通过/驳回/下架/移除 + 举报处理 + JSON 批量导入。均需管理员权限。 */
@Controller('admin/gallery')
@UseGuards(JwtAuthGuard, AdminGuard)
export class GalleryAdminController {
  constructor(
    private readonly service: GalleryService,
    private readonly batchJobService: BatchJobService,
  ) {}

  @Get('pending')
  listPending(@Query('cursor') cursor?: string) {
    return this.service.listPending(cursor, 20);
  }

  @Get()
  listByStatus(@Query('status') status?: string, @Query('cursor') cursor?: string) {
    return this.service.listByStatus(status, cursor, 20);
  }

  @Post('import')
  importGallery(
    @CurrentUser() user: AuthUser,
    @Body() body: { items: ResourcePayload[] },
  ) {
    const userId = getCurrentUserId(user);
    return this.batchJobService.createAndProcess(
      userId,
      'IMPORT',
      ResourceType.GALLERY_POST,
      { items: body.items ?? [] },
    );
  }

  @Get('import-template')
  getImportTemplate() {
    return [
      {
        kind: 'IMAGE',
        title: '',
        description: '',
        category: '',
        tags: [],
        coverImage: '',
        mediaUrls: [],
        aspectRatio: '',
        durationSec: 0,
      },
    ];
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approve(getCurrentUserId(user), id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: RejectGalleryPostDto,
  ) {
    return this.service.reject(getCurrentUserId(user), id, body);
  }

  @Post(':id/hide')
  hide(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.hide(getCurrentUserId(user), id);
  }

  @Post(':id/remove')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(getCurrentUserId(user), id);
  }

  @Post('reports/:id/resolve')
  resolveReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ResolveGalleryReportDto,
  ) {
    return this.service.resolveReport(getCurrentUserId(user), id, body);
  }
}
