import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TemplateStatus } from '../prisma/generated';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import {
  VideoWorkflowTemplatesService,
  type CreateWorkflowTemplateDto,
} from './video-workflow-templates.service';
import type { AuthUser } from '@autix/types';

@UseGuards(JwtAuthGuard)
@Controller('marketplace/video-workflow-templates')
export class VideoWorkflowTemplatesController {
  constructor(
    private readonly service: VideoWorkflowTemplatesService,
  ) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('status') status?: TemplateStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      category,
      status,
      page: page ? +page : undefined,
      pageSize: pageSize ? +pageSize : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateWorkflowTemplateDto) {
    const userId = getCurrentUserId(user);
    return this.service.create(userId, body);
  }

  @Post(':id/create-project')
  createProjectFromTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id') templateId: string,
    @Body() body: { variables?: Record<string, string>; conversationId?: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.service.createProjectFromTemplate(
      templateId,
      userId,
      body.variables,
      body.conversationId,
    );
  }
}
