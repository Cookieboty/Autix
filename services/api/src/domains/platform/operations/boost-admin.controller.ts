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
  CreateBoostDto,
  ListBoostsQueryDto,
  UpdateBoostDto,
} from './dto/boost.dto';
import { BoostService } from './boost.service';

/** 后台内容加热接口：新增/更新/撤销 + 列表检索。全部需要管理员权限（gallery-design.md §十一）。 */
@Controller('admin/resources')
@UseGuards(AdminGuard)
export class BoostAdminController {
  constructor(private readonly service: BoostService) {}

  @Get('boosts')
  list(@Query() query: ListBoostsQueryDto) {
    return this.service.listBoosts({
      resourceType: query.type,
      query: query.query,
    });
  }

  @Post(':type/:id/boost')
  create(
    @CurrentUser() user: AuthUser,
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: CreateBoostDto,
  ) {
    return this.service.createBoost(getCurrentUserId(user), type, id, body);
  }

  @Patch('boosts/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateBoostDto,
  ) {
    return this.service.updateBoost(getCurrentUserId(user), id, body);
  }

  @Delete('boosts/:id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.revokeBoost(getCurrentUserId(user), id);
  }
}
