import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions('role:create')
  create(@Body() dto: CreateRoleDto): Promise<any> {
    return this.roleService.create(dto);
  }

  @Get()
  @Permissions('role:read')
  findAll(): Promise<any> {
    return this.roleService.findAll();
  }

  @Get(':id')
  @Permissions('role:read')
  findOne(@Param('id') id: string): Promise<any> {
    return this.roleService.findOne(id);
  }

  @Patch(':id')
  @Permissions('role:update')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<any> {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('role:delete')
  remove(@Param('id') id: string): Promise<any> {
    return this.roleService.remove(id);
  }

  @Get(':id/permissions')
  @Permissions('role:read')
  getPermissions(@Param('id') id: string): Promise<any> {
    return this.roleService.getPermissions(id);
  }

  @Put(':id/permissions')
  @Permissions('role:update')
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionsDto): Promise<any> {
    return this.roleService.assignPermissions(id, dto);
  }
}
