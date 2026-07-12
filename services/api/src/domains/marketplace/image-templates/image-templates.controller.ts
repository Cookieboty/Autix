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
  UseGuards,
} from '@nestjs/common';
import { TemplateStatus, ResourceType } from '../../platform/prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import {
  CurrentUser,
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { BatchJobService } from '../../admin/admin/batch-job.service';
import {
  ImageTemplatesService,
  type CreateImageTemplateDto,
  type UpdateImageTemplateDto,
} from './image-templates.service';
import type { RuntimeOverrideDto } from '../../platform/common/base-resource.service';
import type { AuthUser } from '@autix/domain';

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
  async findOne(
    @OptionalCurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    const userId = user?.id;
    const tpl = await this.service.findById(id);
    await this.service.recordView(userId, id).catch(() => undefined);
    return tpl;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.service.like(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  favorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.service.favorite(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/generations')
  createGeneration(
    @CurrentUser() user: AuthUser,
    @Param('id') templateId: string,
    @Body()
    body: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
      modelConfigId?: string;
    },
  ) {
    const userId = getCurrentUserId(user);
    return this.service.createGeneration(templateId, userId, body);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('generations/image')
export class ImageGenerationController {
  constructor(private readonly service: ImageTemplatesService) {}

  @Get('my')
  myGenerations(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.service.findMyGenerations(
      userId,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.service.findGeneration(id, userId);
  }

  @Post(':id/turns')
  async addTurn(
    @CurrentUser() user: AuthUser,
    @Param('id') generationId: string,
    @Body()
    body: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    const userId = getCurrentUserId(user);
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

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateImageTemplateDto) {
    const adminId = getCurrentUserId(user);
    return this.service.create(adminId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateImageTemplateDto,
  ) {
    const adminId = getCurrentUserId(user);
    return this.service.update(id, adminId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const adminId = getCurrentUserId(user);
    await this.service.remove(id, adminId);
  }

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

  @Post('batch-review')
  batchReview(
    @CurrentUser() user: AuthUser,
    @Body()
    body: { ids: string[]; action: 'approve' | 'reject' | 'revise'; reason?: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.batchJobService.createAndProcess(
      userId,
      body.action.toUpperCase() as 'APPROVE' | 'REJECT' | 'REVISE',
      ResourceType.IMAGE_TEMPLATE,
      { ids: body.ids ?? [], action: body.action, reason: body.reason },
    );
  }

  @Post('batch-delete')
  batchDelete(@CurrentUser() user: AuthUser, @Body() body: { ids: string[] }) {
    const userId = getCurrentUserId(user);
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

  @Patch(':id/hot')
  setHot(@Param('id') id: string, @Body() body: { isHot: boolean }) {
    return this.service.setHot(id, body.isHot);
  }
}
