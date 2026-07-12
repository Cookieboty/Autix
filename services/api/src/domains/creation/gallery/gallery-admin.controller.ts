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
import { RejectGalleryPostDto } from './dto/reject-post.dto';
import { ResolveGalleryReportDto } from './dto/resolve-report.dto';

/** 广场审核后台：待审列表 + 通过/驳回/下架/移除 + 举报处理。均需管理员权限。 */
@Controller('admin/gallery')
@UseGuards(JwtAuthGuard, AdminGuard)
export class GalleryAdminController {
  constructor(private readonly service: GalleryService) {}

  /** 分类下拉数据（须声明在 @Get() 之前，避免被通配吞掉）。 */
  @Get('categories')
  listCategories() {
    return this.service.listCategories();
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
      page,
      pageSize,
    });
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
