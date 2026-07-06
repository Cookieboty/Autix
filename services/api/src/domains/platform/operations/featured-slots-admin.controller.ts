import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { AdminGuard } from '../../identity/auth/admin.guard';
import {
  CurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import {
  CreateFeaturedSlotDto,
  ReorderFeaturedSlotsDto,
  SearchCandidatesQueryDto,
  UpdateFeaturedSlotDto,
} from './dto/featured-slot.dto';
import { FeaturedSlotsService } from './featured-slots.service';

/** 后台运营位编排接口：创建/更新/删除/重排 + 候选资源检索。全部需要管理员权限。 */
@Controller('admin/featured-slots')
@UseGuards(AdminGuard)
export class FeaturedSlotsAdminController {
  constructor(private readonly service: FeaturedSlotsService) {}

  @Get()
  list(@Query('placement') placement: string) {
    return this.service.listAdmin(placement);
  }

  // 必须先于 `:id` 声明，否则 "candidates" 会被当作 :id 路由吃掉。
  @Get('candidates')
  searchCandidates(@Query() query: SearchCandidatesQueryDto) {
    return this.service.searchCandidates(query.resourceType, query.query ?? '');
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateFeaturedSlotDto) {
    return this.service.createSlot(getCurrentUserId(user), body);
  }

  // 同理，需先于 `:id` 声明。
  @Patch('reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() body: ReorderFeaturedSlotsDto) {
    return this.service.reorder(
      getCurrentUserId(user),
      body.placement,
      body.orderedIds,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateFeaturedSlotDto,
  ) {
    return this.service.updateSlot(getCurrentUserId(user), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteSlot(getCurrentUserId(user), id);
  }
}
