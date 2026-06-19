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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import {
  MaterialsService,
  type MaterialCreateInput,
  type MaterialUpdateInput,
} from './materials.service';
import type { AuthUser } from '@autix/types';

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
  ) {
    const userId = getCurrentUserId(user);
    return this.materialsService.list(userId, {
      type,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
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
}
