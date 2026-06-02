import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { SystemService } from './system.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('systems')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post()
  @Permissions('system:create')
  create(@Body() dto: CreateSystemDto) {
    return this.systemService.create(dto);
  }

  @Get()
  @Permissions('system:read')
  findAll() {
    return this.systemService.findAll();
  }

  @Get('my')
  findMy(@Request() req) {
    return this.systemService.findUserSystems(req.user.id);
  }

  @Get(':id')
  @Permissions('system:read')
  findOne(@Param('id') id: string) {
    return this.systemService.findOne(id);
  }

  @Get(':id/menus')
  @Permissions('system:read')
  getMenus(@Param('id') id: string) {
    return this.systemService.getSystemMenus(id);
  }

  @Patch(':id')
  @Permissions('system:update')
  update(@Param('id') id: string, @Body() dto: UpdateSystemDto) {
    return this.systemService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('system:delete')
  remove(@Param('id') id: string) {
    return this.systemService.remove(id);
  }
}
