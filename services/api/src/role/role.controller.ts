import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Query } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignMenusDto } from './dto/assign-menus.dto';
import { AssignMenusAndPermissionsDto } from './dto/assign-menus-and-permissions.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

type RoleCreateResult = Awaited<ReturnType<RoleService['create']>>;
type RoleListResult = Awaited<ReturnType<RoleService['findAll']>>;
type RoleDetailResult = Awaited<ReturnType<RoleService['findOne']>>;
type RoleUpdateResult = Awaited<ReturnType<RoleService['update']>>;
type RoleRemoveResult = Awaited<ReturnType<RoleService['remove']>>;
type RolePermissionsResult = Awaited<ReturnType<RoleService['getPermissions']>>;
type RoleMenusResult = Awaited<ReturnType<RoleService['getMenus']>>;
type RoleAssignPermissionsResult = Awaited<ReturnType<RoleService['assignPermissions']>>;
type RoleAssignMenusResult = Awaited<ReturnType<RoleService['assignMenus']>>;
type RoleAssignMenusAndPermissionsResult = Awaited<
  ReturnType<RoleService['assignMenusAndPermissions']>
>;

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions('role:create')
  create(@Body() dto: CreateRoleDto): Promise<RoleCreateResult> {
    return this.roleService.create(dto);
  }

  @Get()
  @Permissions('role:read')
  findAll(@Query('systemId') systemId?: string): Promise<RoleListResult> {
    return this.roleService.findAll(systemId);
  }

  @Get(':id')
  @Permissions('role:read')
  findOne(@Param('id') id: string): Promise<RoleDetailResult> {
    return this.roleService.findOne(id);
  }

  @Patch(':id')
  @Permissions('role:update')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<RoleUpdateResult> {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('role:delete')
  remove(@Param('id') id: string): Promise<RoleRemoveResult> {
    return this.roleService.remove(id);
  }

  @Get(':id/permissions')
  @Permissions('role:read')
  getPermissions(@Param('id') id: string): Promise<RolePermissionsResult> {
    return this.roleService.getPermissions(id);
  }

  @Put(':id/permissions')
  @Permissions('role:update')
  assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ): Promise<RoleAssignPermissionsResult> {
    return this.roleService.assignPermissions(id, dto);
  }

  @Get(':id/menus')
  @Permissions('role:read')
  getMenus(@Param('id') id: string): Promise<RoleMenusResult> {
    return this.roleService.getMenus(id);
  }

  @Put(':id/menus')
  @Permissions('role:update')
  assignMenus(
    @Param('id') id: string,
    @Body() dto: AssignMenusDto,
  ): Promise<RoleAssignMenusResult> {
    return this.roleService.assignMenus(id, dto.menuIds);
  }

  @Put(':id/menus-and-permissions')
  @Permissions('role:update')
  assignMenusAndPermissions(
    @Param('id') id: string,
    @Body() dto: AssignMenusAndPermissionsDto,
  ): Promise<RoleAssignMenusAndPermissionsResult> {
    return this.roleService.assignMenusAndPermissions(id, dto.menuIds, dto.permissionIds);
  }
}
