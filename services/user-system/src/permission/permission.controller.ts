import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @Permissions('permission:create')
  create(@Body() dto: CreatePermissionDto): Promise<any> {
    return this.permissionService.create(dto);
  }

  @Get()
  @Permissions('permission:read')
  findAll(): Promise<any> {
    return this.permissionService.findAll();
  }

  @Get(':id')
  @Permissions('permission:read')
  findOne(@Param('id') id: string): Promise<any> {
    return this.permissionService.findOne(id);
  }

  @Patch(':id')
  @Permissions('permission:update')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto): Promise<any> {
    return this.permissionService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('permission:delete')
  remove(@Param('id') id: string): Promise<any> {
    return this.permissionService.remove(id);
  }
}
