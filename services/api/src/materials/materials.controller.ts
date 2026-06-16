import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  MaterialsService,
  type MaterialCreateInput,
  type MaterialUpdateInput,
} from './materials.service';

@UseGuards(JwtAuthGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('entitlement')
  entitlement(@Req() req: Request) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.getEntitlement(userId);
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.list(userId, {
      type,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('upload')
  uploadUrl(
    @Req() req: Request,
    @Body() body: { fileName: string; contentType: string; folder?: string },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.createUploadUrl(userId, body);
  }

  @Post()
  create(@Req() req: Request, @Body() body: MaterialCreateInput) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.create(userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: MaterialUpdateInput,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.update(userId, id, body);
  }

  @Post(':id/use')
  use(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.useAsset(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.remove(userId, id);
  }

  @Post('batch-delete')
  batchDelete(@Req() req: Request, @Body() body: { ids?: string[] }) {
    const userId = (req.user as { userId: string }).userId;
    return this.materialsService.batchRemove(userId, body.ids ?? []);
  }
}
