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
import {
  CurrentUser,
  OptionalCurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import {
  AgentsService,
  type CreateAgentDto,
  type UpdateAgentDto,
} from './agents.service';
import type { RuntimeOverrideDto } from '../../platform/common/base-resource.service';
import type { AuthUser } from '@autix/domain';

@Controller('marketplace/agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

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
    const row = await this.service.findById(id);
    await this.service.recordView(userId, id).catch(() => undefined);
    return row;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateAgentDto) {
    const userId = getCurrentUserId(user);
    return this.service.create(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateAgentDto,
  ) {
    const userId = getCurrentUserId(user);
    return this.service.update(id, userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.service.remove(id, userId);
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
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/agents')
export class AgentsAdminController {
  constructor(private readonly service: AgentsService) {}

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
