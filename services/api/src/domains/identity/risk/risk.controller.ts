import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { RiskService, type RiskLevelValue } from './risk.service';
import { ListRiskUsersQueryDto, RiskActionDto, SetRiskLevelDto } from './dto/risk.dto';

/**
 * 风控与用户管理（R1：看 + 人工处置）。
 * 与其余管理面板一致，仅由 AdminGuard 守卫（系统管理员/超管可访问），不再要求单独的细粒度权限码。
 */
@Controller('admin/risk')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('users')
  listUsers(@Query() query: ListRiskUsersQueryDto) {
    return this.riskService.listFlaggedUsers({
      level: query.level,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.riskService.getUserRiskDetail(id);
  }

  @Post('users/:id/level')
  setLevel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: SetRiskLevelDto,
  ) {
    return this.riskService.setLevel(getCurrentUserId(user), id, body.level as RiskLevelValue, body.reason);
  }

  @Post('users/:id/block')
  block(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: RiskActionDto) {
    return this.riskService.block(getCurrentUserId(user), id, body.reason);
  }

  @Post('users/:id/unblock')
  unblock(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: RiskActionDto) {
    return this.riskService.unblock(getCurrentUserId(user), id, body.reason);
  }
}
