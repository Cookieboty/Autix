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
import { TemplateStatus, ResourceType } from '../prisma/generated';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Public } from '../auth/decorators/public.decorator';
import { BatchJobService } from '../admin/batch-job.service';
import {
  ImageTemplatesService,
  type CreateImageTemplateDto,
  type UpdateImageTemplateDto,
} from './image-templates.service';
import type { RuntimeOverrideDto } from '../common/base-resource.service';

@Controller('marketplace/image-templates')
export class ImageTemplatesController {
  constructor(private readonly service: ImageTemplatesService) {}

  @Public()
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

  @Public()
  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    const tpl = await this.service.findById(id);
    await this.service.recordView(userId, id).catch(() => undefined);
    return tpl;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() body: CreateImageTemplateDto) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.create(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateImageTemplateDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.update(id, userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    await this.service.remove(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.like(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  favorite(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.favorite(userId, id);
  }

  @UseGuards(JwtAuthGuard)
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
@Controller('generations/image')
export class ImageGenerationController {
  constructor(private readonly service: ImageTemplatesService) {}

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
@Controller('admin/image-templates')
export class ImageTemplatesAdminController {
  constructor(
    private readonly service: ImageTemplatesService,
    private readonly batchJobService: BatchJobService,
  ) {}

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

  @Post('import')
  importTemplates(
    @Req() req: Request,
    @Body() body: { items: Record<string, any>[] },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.batchJobService.createAndProcess(
      userId,
      'IMPORT',
      ResourceType.IMAGE_TEMPLATE,
      { items: body.items ?? [] },
    );
  }

  @Get('import-template')
  getImportTemplate() {
    return [
      {
        title: '',
        description: '',
        category: '',
        prompt: '',
        variables: {},
        coverImage: '',
        exampleImages: [],
        modelHint: '',
        tags: [],
        pointsCost: 0,
        originalUrl: '',
        authorName: '',
        authorUrl: '',
        sourcePlatform: '',
        externalId: '',
        externalSlug: '',
        externalMetadata: {},
      },
    ];
  }

  @Get('export')
  exportTemplates(
    @Query('status') status?: TemplateStatus,
    @Query('category') category?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    return (this.service as any).delegate.findMany({ where });
  }

  @Post('batch-review')
  batchReview(
    @Req() req: Request,
    @Body()
    body: { ids: string[]; action: 'approve' | 'reject' | 'revise'; reason?: string },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.batchJobService.createAndProcess(
      userId,
      body.action.toUpperCase() as 'APPROVE' | 'REJECT' | 'REVISE',
      ResourceType.IMAGE_TEMPLATE,
      { ids: body.ids ?? [], action: body.action, reason: body.reason },
    );
  }

  @Post('batch-delete')
  batchDelete(@Req() req: Request, @Body() body: { ids: string[] }) {
    const userId = (req.user as { userId: string }).userId;
    return this.batchJobService.createAndProcess(
      userId,
      'DELETE',
      ResourceType.IMAGE_TEMPLATE,
      { ids: body.ids ?? [] },
    );
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
