import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@repo/types';

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
  findAll(): Promise<any> {
    return this.menuService.findAll();
  }

  @Get('user')
  getUserMenus(@CurrentUser() user: AuthUser): Promise<any> {
    return this.menuService.findUserMenus(user.id);
  }

  @Get(':id')
  @Permissions('menu:read')
  findOne(@Param('id') id: string): Promise<any> {
    return this.menuService.findOne(id);
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
