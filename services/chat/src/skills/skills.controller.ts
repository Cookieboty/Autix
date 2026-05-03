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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TemplateStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
  SkillsService,
  type CreateSkillDto,
  type UpdateSkillDto,
} from './skills.service';
import type { RuntimeOverrideDto } from '../common/base-resource.service';

@UseGuards(JwtAuthGuard)
@Controller('api/marketplace/skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: 'newest' | 'popular' | 'likes',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('authorId') authorId?: string,
    @Query('status') status?: TemplateStatus,
  ) {
    return this.service.findAll({
      category,
      search,
      sort,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
      authorId,
      status,
    });
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    const row = await this.service.findById(id);
    await this.service.recordView(userId, id).catch(() => undefined);
    return row;
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateSkillDto) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.create(userId, body);
  }

  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateSkillDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.update(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    await this.service.remove(id, userId);
  }

  @Post(':id/like')
  like(@Param('id') id: string) {
    return this.service.like(id);
  }

  @Post(':id/favorite')
  favorite(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.favorite(userId, id);
  }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api/admin/skills')
export class SkillsAdminController {
  constructor(private readonly service: SkillsService) {}

  @Get()
  findForReview(
    @Query('status') status?: TemplateStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findForReview({
      status,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject' | 'revise'; reason?: string },
  ) {
    return this.service.review(id, body);
  }

  @Patch(':id/runtime')
  overrideRuntime(@Param('id') id: string, @Body() body: RuntimeOverrideDto) {
    return this.service.overrideRuntime(id, body);
  }
}
