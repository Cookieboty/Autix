import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { Permissions } from '@/auth/decorators/permissions.decorator';
import { PermissionTreeService } from './permission-tree.service';

@Controller('permission-tree')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionTreeController {
  constructor(private readonly permissionTreeService: PermissionTreeService) {}

  @Get()
  @Permissions('permission:read')
  async getPermissionTree(): Promise<any> {
    return this.permissionTreeService.getPermissionTree();
  }

  @Get('system/:systemId')
  @Permissions('permission:read')
  async getSystemTree(@Param('systemId') systemId: string): Promise<any> {
    return this.permissionTreeService.getSystemTree(systemId);
  }
}
