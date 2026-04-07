import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@repo/types';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Permissions('user:create')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser): Promise<any> {
    return this.userService.create(dto, user);
  }

  @Get()
  @Permissions('user:read')
  findAll(@Query() query: QueryUserDto, @CurrentUser() user: AuthUser): Promise<any> {
    return this.userService.findAll(query, user);
  }

  @Get(':id')
  @Permissions('user:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<any> {
    return this.userService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions('user:update')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser): Promise<any> {
    return this.userService.update(id, dto, user);
  }

  @Delete(':id')
  @Permissions('user:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.userService.remove(id, user);
  }

  @Post(':id/reset-password')
  @Permissions('user:update')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: AuthUser) {
    return this.userService.resetPassword(id, dto, user);
  }

  @Patch(':id/status')
  @Permissions('user:update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: AuthUser) {
    return this.userService.updateStatus(id, dto, user);
  }

  @Get(':id/roles')
  @Permissions('user:read')
  getUserRoles(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.userService.getUserRolesBySystem(id, user);
  }

  @Put(':id/roles')
  @Permissions('user:update')
  assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto, @CurrentUser() user: AuthUser) {
    return this.userService.assignRoles(id, dto.systemRoles, user);
  }
}
