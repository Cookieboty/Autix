import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@autix/types';

@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @Permissions('menu:create')
  create(@Body() dto: CreateMenuDto): Promise<any> {
    return this.menuService.create(dto);
  }

  @Get()
  @Permissions('menu:read')
  findAll(@Query('systemId') systemId?: string): Promise<any> {
    return this.menuService.findAll(systemId);
  }

  @Get('user')
  getUserMenus(
    @CurrentUser() user: AuthUser,
    @Query('systemId') systemId?: string,
  ): Promise<any> {
    return this.menuService.findUserMenus(user.id, systemId);
  }

  @Get(':id')
  @Permissions('menu:read')
  findOne(@Param('id') id: string): Promise<any> {
    return this.menuService.findOne(id);
  }

  @Get(':id/permissions')
  @Permissions('menu:read')
  getPermissions(@Param('id') id: string): Promise<any> {
    return this.menuService.getMenuPermissions(id);
  }

  @Patch(':id')
  @Permissions('menu:update')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto): Promise<any> {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('menu:delete')
  remove(@Param('id') id: string): Promise<any> {
    return this.menuService.remove(id);
  }
}
