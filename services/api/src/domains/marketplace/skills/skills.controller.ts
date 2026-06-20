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
  UseGuards,
} from '@nestjs/common';
import { TemplateStatus } from '../../platform/prisma/generated';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { AdminGuard } from '../../identity/auth/admin.guard';
import {
  SkillsService,
  type CreateSkillDto,
  type UpdateSkillDto,
} from './skills.service';
import type { RuntimeOverrideDto } from '../../platform/common/base-resource.service';
import type { AuthUser } from '@autix/domain';

@UseGuards(JwtAuthGuard)
@Controller('marketplace/skills')
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
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    const row = await this.service.findById(id);
    await this.service.recordView(userId, id).catch(() => undefined);
    return row;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateSkillDto) {
    const userId = getCurrentUserId(user);
    return this.service.create(userId, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateSkillDto,
  ) {
    const userId = getCurrentUserId(user);
    return this.service.update(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.service.remove(id, userId);
  }

  @Post(':id/like')
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.service.like(userId, id);
  }

  @Post(':id/favorite')
  favorite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.service.favorite(userId, id);
  }
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/skills')
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
