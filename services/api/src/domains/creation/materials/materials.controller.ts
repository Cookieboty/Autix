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

  @Get('entitlement')
  entitlement(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.materialsService.getEntitlement(userId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('folderId') folderId?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.list(userId, {
      type,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      folderId,
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
