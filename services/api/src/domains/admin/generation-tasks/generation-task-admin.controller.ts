import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { PermissionsGuard } from '../../identity/auth/guards/permissions.guard';
import { Permissions } from '../../identity/auth/decorators/permissions.decorator';
import { GenerationTaskListQueryDto } from './dto/generation-task-query.dto';
import { GenerationTaskAdminService } from './generation-task-admin.service';

/**
 * 必须显式挂 `@Permissions`：`PermissionsGuard` 在**没有**该装饰器时直接放行
 * （permissions.guard.ts:13-16），而 `AdminGuard` 是粗粒度布尔门——不挂等于
 * 所有管理员都能翻全量用户 prompt。
 *
 * 权限码需在权限种子数据中播种，否则只有 isSuperAdmin 能过（现有 payment:* 就是这个状态，
 * 本仓目前没有权限播种脚本）。
 */
@Controller('admin/generation-tasks')
@UseGuards(JwtAuthGuard, AdminGuard, PermissionsGuard)
export class GenerationTaskAdminController {
  constructor(private readonly service: GenerationTaskAdminService) {}

  @Get()
  @Permissions('generation:view')
  async list(@Query() query: GenerationTaskListQueryDto) {
    return this.service.list(query);
  }

  /** 详情含 prompt / 参数快照 / 上游原文，故要求更高一级权限。 */
  @Get(':id')
  @Permissions('generation:view-content')
  async detail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }
}
