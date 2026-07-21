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
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import {
  MaterialsService,
  type MaterialCreateInput,
  type MaterialUpdateInput,
} from './materials.service';
import type { AuthUser } from '@autix/domain';

@UseGuards(JwtAuthGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  /** /asset 左侧导航角标：全部/收藏/各类型的素材数。注意须在 @Get() 之前声明，否则被通配吃掉。 */
  @Get('counts')
  counts(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.materialsService.counts(userId);
  }

  /**
   * Plan C Task 11：去重后的浏览历史（按 (resourceType,resourceId) 取最近一次），游标分页。
   * 与 POST /materials/save-from-history 配对，构成 Task 12 前端"从历史保存到素材库"的读写两端。
   * 畸形 cursor 由 MaterialsService.decodeHistoryCursor 拦成 400，不会到达 SQL。
   */
  @Get('history')
  listHistory(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.listHistory(userId, {
      cursor,
      take: take ? Number(take) : undefined,
    });
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('folderId') folderId?: string,
    @Query('librarySource') librarySource?: string,
    @Query('excludeFavorites') excludeFavorites?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.list(userId, {
      type,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      folderId,
      librarySource,
      // query 参数是字符串，'false' 也是真值——必须显式比对。
      excludeFavorites: excludeFavorites === 'true',
    });
  }

  @Post('upload')
  uploadUrl(
    @CurrentUser() user: AuthUser,
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.createUploadUrl(userId, body);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: MaterialCreateInput) {
    const userId = getCurrentUserId(user);
    return this.materialsService.create(userId, body);
  }

  /** Plan C Task 11：从浏览历史保存素材——反伪造 + 类型校验见 MaterialsService.saveFromHistory。 */
  @Post('save-from-history')
  saveFromHistory(
    @CurrentUser() user: AuthUser,
    @Body() body: { resourceType?: string; resourceId?: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.saveFromHistory(userId, body.resourceType ?? '', body.resourceId ?? '');
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: MaterialUpdateInput,
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.update(userId, id, body);
  }

  @Post(':id/use')
  use(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.materialsService.useAsset(userId, id);
  }

  /** Plan C Task 10：下载前置 sourceState 拦截（blocked/missing → 403），不要求会员。 */
  @Post(':id/download')
  download(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.materialsService.download(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.materialsService.remove(userId, id);
  }

  @Post('batch-delete')
  batchDelete(@CurrentUser() user: AuthUser, @Body() body: { ids?: string[] }) {
    const userId = getCurrentUserId(user);
    return this.materialsService.batchRemove(userId, body.ids ?? []);
  }

  @Post('batch-move')
  batchMove(
    @CurrentUser() user: AuthUser,
    @Body() body: { ids?: string[]; folderId?: string | null },
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.batchMove(userId, body.ids ?? [], body.folderId ?? null);
  }
}
