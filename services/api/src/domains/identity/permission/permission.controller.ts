import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

type PermissionCreateResult = Awaited<ReturnType<PermissionService['create']>>;
type PermissionListResult = Awaited<ReturnType<PermissionService['findAll']>>;
type PermissionDetailResult = Awaited<ReturnType<PermissionService['findOne']>>;
type PermissionUpdateResult = Awaited<ReturnType<PermissionService['update']>>;
type PermissionRemoveResult = Awaited<ReturnType<PermissionService['remove']>>;

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @Permissions('permission:create')
  create(@Body() dto: CreatePermissionDto): Promise<PermissionCreateResult> {
    return this.permissionService.create(dto);
  }

  @Get()
  @Permissions('permission:read')
  findAll(
    @Query('systemId') systemId?: string,
    @Query('menuId') menuId?: string,
    @Query('type') type?: string,
  ): Promise<PermissionListResult> {
    return this.permissionService.findAll(systemId, menuId, type);
  }

  @Get(':id')
  @Permissions('permission:read')
  findOne(@Param('id') id: string): Promise<PermissionDetailResult> {
    return this.permissionService.findOne(id);
  }

  @Patch(':id')
  @Permissions('permission:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ): Promise<PermissionUpdateResult> {
    return this.permissionService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('permission:delete')
  remove(@Param('id') id: string): Promise<PermissionRemoveResult> {
    return this.permissionService.remove(id);
  }
}
