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
  VideoTemplatesService,
  type CreateVideoTemplateDto,
  type UpdateVideoTemplateDto,
} from './video-templates.service';
import type { RuntimeOverrideDto } from '../common/base-resource.service';

@UseGuards(JwtAuthGuard)
@Controller('api/marketplace/video-templates')
export class VideoTemplatesController {
  constructor(private readonly service: VideoTemplatesService) {}

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
    const tpl = await this.service.findById(id);
    await this.service.recordView(userId, id).catch(() => undefined);
    return tpl;
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateVideoTemplateDto) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.create(userId, body);
  }

  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateVideoTemplateDto,
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

  @Post(':id/generations')
  createGeneration(
    @Req() req: Request,
    @Param('id') templateId: string,
    @Body()
    body: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
      modelConfigId?: string;
    },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.createGeneration(templateId, userId, body);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('api/generations/video')
export class VideoGenerationController {
  constructor(private readonly service: VideoTemplatesService) {}

  @Get('my')
  myGenerations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.findMyGenerations(
      userId,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.findGeneration(id, userId);
  }

  @Post(':id/turns')
  async addTurn(
    @Req() req: Request,
    @Param('id') generationId: string,
    @Body()
    body: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.service.findGeneration(generationId, userId);
    return this.service.addTurn(generationId, body);
  }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api/admin/video-templates')
export class VideoTemplatesAdminController {
  constructor(private readonly service: VideoTemplatesService) {}

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
