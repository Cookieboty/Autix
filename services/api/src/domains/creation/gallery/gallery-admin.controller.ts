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
import { GalleryService } from './gallery.service';
import { GalleryTemplateConversionService } from './gallery-template-conversion.service';
import { BatchModerateGalleryDto } from './dto/batch-moderate.dto';
import { RejectGalleryPostDto } from './dto/reject-post.dto';
import { ResolveGalleryReportDto } from './dto/resolve-report.dto';
import { BatchJobService } from '../../admin/admin/batch-job.service';
import { ResourceType } from '../../platform/prisma/generated';

/** 广场审核后台：待审列表 + 通过/驳回/下架/移除 + 举报处理 + JSON 批量导入。均需管理员权限。 */
@Controller('admin/gallery')
@UseGuards(JwtAuthGuard, AdminGuard)
export class GalleryAdminController {
  constructor(
    private readonly service: GalleryService,
    private readonly conversion: GalleryTemplateConversionService,
    private readonly batchJobService: BatchJobService,
  ) {}

  /** 分类下拉数据（须声明在 @Get() 之前，避免被通配吞掉）。 */
  @Get('categories')
  listCategories() {
    return this.service.listCategories();
  }

  /** JSON 批量导入：落 PENDING + mediaMigrated=false，媒体由迁移 worker 异步搬运后自动发布。 */
  @Post('import')
  importGallery(
    @CurrentUser() user: AuthUser,
    @Body() body: { items?: Record<string, unknown>[] },
  ) {
    return this.batchJobService.createAndProcess(
      getCurrentUserId(user),
      'IMPORT',
      ResourceType.GALLERY_POST,
      { items: body.items ?? [] },
    );
  }

  /** 页码分页 + 筛选列表（total/page/pageSize/totalPages）。 */
  @Get()
  list(
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('category') category?: string,
    @Query('sourceType') sourceType?: string,
    @Query('search') search?: string,
    @Query('externalOnly') externalOnly?: string,
    @Query('migrationFailed') migrationFailed?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listAdminPage({
      status,
      kind,
      category,
      sourceType,
      search,
      externalOnly,
      migrationFailed,
      page,
      pageSize,
    });
  }

  /** 批量审核：一次收 ids + action，逐条尽力执行并返回每条结果。 */
  @Post('batch')
  batchModerate(@CurrentUser() user: AuthUser, @Body() body: BatchModerateGalleryDto) {
    return this.service.batchModerate(getCurrentUserId(user), body);
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

  /** 解封被处罚下架的作品，HIDDEN → PUBLISHED。 */
  @Post(':id/unhide')
  unhide(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.unhide(getCurrentUserId(user), id);
  }

  @Post(':id/remove')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(getCurrentUserId(user), id);
  }

  /** Plan C Task 9：把已发布图片作品转换为图片模板（幂等，重复调用返回已有模板）。 */
  @Post(':id/convert-to-template')
  convertToTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.conversion.convertToTemplate(getCurrentUserId(user), id);
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
