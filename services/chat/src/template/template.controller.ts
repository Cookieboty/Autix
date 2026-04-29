import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
  TemplateService,
  type CreateTemplateDto,
  type UpdateTemplateDto,
} from './template.service';
import { TemplateStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('api/templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: 'newest' | 'popular' | 'likes',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('authorId') authorId?: string,
    @Query('status') status?: TemplateStatus,
  ) {
    return this.templateService.findAll({
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
  async findOne(@Param('id') id: string) {
    return this.templateService.findById(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: CreateTemplateDto) {
    const userId = (req.user as any).userId;
    return this.templateService.create(userId, body);
  }

  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateTemplateDto,
  ) {
    const userId = (req.user as any).userId;
    return this.templateService.update(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.templateService.remove(id, userId);
  }

  @Post(':id/like')
  async like(@Param('id') id: string) {
    return this.templateService.like(id);
  }

  // ── Generation endpoints ────────────────────────────────────────────────

  @Post(':id/generations')
  async createGeneration(
    @Req() req: Request,
    @Param('id') templateId: string,
    @Body() body: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
    },
  ) {
    const userId = (req.user as any).userId;
    return this.templateService.createGeneration(templateId, userId, body);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('api/generations')
export class GenerationController {
  constructor(private readonly templateService: TemplateService) {}

  @Get('my')
  async myGenerations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as any).userId;
    return this.templateService.findMyGenerations(
      userId,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    return this.templateService.findGeneration(id, userId);
  }

  @Post(':id/turns')
  async addTurn(
    @Req() req: Request,
    @Param('id') generationId: string,
    @Body() body: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    const userId = (req.user as any).userId;
    await this.templateService.findGeneration(generationId, userId);
    return this.templateService.addTurn(generationId, body);
  }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api/admin/templates')
export class TemplateAdminController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  async findForReview(
    @Query('status') status?: TemplateStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.templateService.findForReview({
      status,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Post(':id/review')
  async review(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject' | 'revise'; reason?: string },
  ) {
    return this.templateService.review(id, body);
  }
}
