import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { SystemService } from './system.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';

type CreateSystemResult = Awaited<ReturnType<SystemService['create']>>;
type SystemListResult = Awaited<ReturnType<SystemService['findAll']>>;
type MySystemsResult = Awaited<ReturnType<SystemService['findUserSystems']>>;
type SystemDetailResult = Awaited<ReturnType<SystemService['findOne']>>;
type SystemMenusResult = Awaited<ReturnType<SystemService['getSystemMenus']>>;
type UpdateSystemResult = Awaited<ReturnType<SystemService['update']>>;
type RemoveSystemResult = Awaited<ReturnType<SystemService['remove']>>;

@Controller('systems')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post()
  @Permissions('system:create')
  create(@Body() dto: CreateSystemDto): Promise<CreateSystemResult> {
    return this.systemService.create(dto);
  }

  @Get()
  @Permissions('system:read')
  findAll(): Promise<SystemListResult> {
    return this.systemService.findAll();
  }

  @Get('my')
  findMy(@Request() req): Promise<MySystemsResult> {
    return this.systemService.findUserSystems(req.user.id);
  }

  @Get(':id')
  @Permissions('system:read')
  findOne(@Param('id') id: string): Promise<SystemDetailResult> {
    return this.systemService.findOne(id);
  }

  @Get(':id/menus')
  @Permissions('system:read')
  getMenus(@Param('id') id: string): Promise<SystemMenusResult> {
    return this.systemService.getSystemMenus(id);
  }

  @Patch(':id')
  @Permissions('system:update')
  update(@Param('id') id: string, @Body() dto: UpdateSystemDto): Promise<UpdateSystemResult> {
    return this.systemService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('system:delete')
  remove(@Param('id') id: string): Promise<RemoveSystemResult> {
    return this.systemService.remove(id);
  }
}
