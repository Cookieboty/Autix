import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@autix/domain';

type UpdateLanguageResult = Awaited<ReturnType<UserService['updateLanguage']>>;
type CreateUserResult = Awaited<ReturnType<UserService['create']>>;
type UserListResult = Awaited<ReturnType<UserService['findAll']>>;
type UserDetailResult = Awaited<ReturnType<UserService['findOne']>>;
type UpdateUserResult = Awaited<ReturnType<UserService['update']>>;
type RemoveUserResult = Awaited<ReturnType<UserService['remove']>>;
type ResetPasswordResult = Awaited<ReturnType<UserService['resetPassword']>>;
type UpdateStatusResult = Awaited<ReturnType<UserService['updateStatus']>>;
type UserRolesResult = Awaited<ReturnType<UserService['getUserRolesBySystem']>>;
type AssignRolesResult = Awaited<ReturnType<UserService['assignRoles']>>;

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('me/language')
  updateMyLanguage(
    @Body() dto: UpdateLanguageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UpdateLanguageResult> {
    return this.userService.updateLanguage(user.id, dto.language);
  }

  @Post()
  @Permissions('user:create')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser): Promise<CreateUserResult> {
    return this.userService.create(dto, user);
  }

  @Get()
  @Permissions('user:read')
  findAll(@Query() query: QueryUserDto, @CurrentUser() user: AuthUser): Promise<UserListResult> {
    return this.userService.findAll(query, user);
  }

  @Get(':id')
  @Permissions('user:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<UserDetailResult> {
    return this.userService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions('user:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UpdateUserResult> {
    return this.userService.update(id, dto, user);
  }

  @Delete(':id')
  @Permissions('user:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<RemoveUserResult> {
    return this.userService.remove(id, user);
  }

  @Post(':id/reset-password')
  @Permissions('user:update')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ResetPasswordResult> {
    return this.userService.resetPassword(id, dto, user);
  }

  @Patch(':id/status')
  @Permissions('user:update')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UpdateStatusResult> {
    return this.userService.updateStatus(id, dto, user);
  }

  @Get(':id/roles')
  @Permissions('user:read')
  getUserRoles(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<UserRolesResult> {
    return this.userService.getUserRolesBySystem(id, user);
  }

  @Put(':id/roles')
  @Permissions('user:update')
  assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AssignRolesResult> {
    return this.userService.assignRoles(id, dto.systemRoles, user);
  }
}
