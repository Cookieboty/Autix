import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TemplateStatus } from '../prisma/generated';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  VideoWorkflowTemplatesService,
  type CreateWorkflowTemplateDto,
} from './video-workflow-templates.service';

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
  create(@Req() req: Request, @Body() body: CreateWorkflowTemplateDto) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.create(userId, body);
  }

  @Post(':id/create-project')
  createProjectFromTemplate(
    @Req() req: Request,
    @Param('id') templateId: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.service.createProjectFromTemplate(
      templateId,
      userId,
      body.variables,
    );
  }
}
