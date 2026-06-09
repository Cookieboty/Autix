import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  VideoProjectService,
  type CreateProjectDto,
  type AddClipDto,
  type UpdateClipDto,
  type AddMaterialDto,
} from './video-project.service';
import { VideoGenerationFlowService } from './video-generation-flow.service';
import { VideoChatService, type VideoDirectorTemplateContext } from './video-chat.service';

@UseGuards(JwtAuthGuard)
@Controller('video-projects')
export class VideoProjectController {
  constructor(
    private readonly projectService: VideoProjectService,
    private readonly generationFlow: VideoGenerationFlowService,
    private readonly videoChatService: VideoChatService,
  ) { }

  @Post()
  create(@Req() req: Request, @Body() body: CreateProjectDto) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.createProject(userId, body);
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getUserProjects(
      userId,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get('workbench/default')
  getWorkbenchDefault(@Req() req: Request) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getOrCreateWorkbenchProject(userId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getProject(id, userId);
  }

  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { title?: string; coverImage?: string },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.updateProject(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.deleteProject(id, userId);
  }

  @Post(':id/clips')
  addClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: AddClipDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.addClip(projectId, userId, body);
  }

  @Put(':id/clips/:clipId')
  updateClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: UpdateClipDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.updateClip(projectId, clipId, userId, body);
  }

  @Delete(':id/clips/:clipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.deleteClip(projectId, clipId, userId);
  }

  @Put(':id/clips/reorder')
  reorderClips(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: { clipIds: string[] },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.reorderClips(projectId, userId, body.clipIds);
  }

  @Post(':id/apply-workflow-template/:templateId')
  async applyWorkflowTemplate(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('templateId') templateId: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.getProject(projectId, userId);
    return this.projectService.createStandaloneProjectFromWorkflowTemplate(
      templateId,
      userId,
      body.variables,
    );
  }

  @Post(':id/apply-video-template/:templateId')
  async applyVideoTemplate(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('templateId') templateId: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.getProject(projectId, userId);
    return this.projectService.createStandaloneProjectFromVideoTemplate(
      templateId,
      userId,
      body.variables,
    );
  }

  @Post(':id/clips/:clipId/materials')
  addMaterial(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: AddMaterialDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.addMaterial(projectId, clipId, userId, body);
  }

  @Delete(':id/materials/:materialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMaterial(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('materialId') materialId: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.removeMaterial(projectId, materialId, userId);
  }

  @Post(':id/clips/:clipId/generate')
  generateClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: { variantLabel?: string },
  ): Promise<{ generationId: string; taskId: string }> {
    const userId = (req.user as { userId: string }).userId;
    return this.generationFlow.generateClip({
      clipId,
      projectId,
      userId,
      variantLabel: body?.variantLabel,
    });
  }

  @Post(':id/generate')
  generateAll(
    @Req() req: Request,
    @Param('id') projectId: string,
  ): Promise<Array<{ generationId: string; taskId: string; clipId: string }>> {
    const userId = (req.user as { userId: string }).userId;
    return this.generationFlow.generateAllClips(projectId, userId);
  }

  @Post(':id/generations/:generationId/refresh')
  refresh(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('generationId') generationId: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.generationFlow.refreshGeneration({
      projectId,
      generationId,
      userId,
    });
  }

  @Get(':id/generations')
  getGenerations(@Req() req: Request, @Param('id') projectId: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getProjectGenerations(projectId, userId);
  }

  @Post(':id/director-chat')
  async directorChat(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: { message: string; modelId?: string; templateContext?: VideoDirectorTemplateContext },
  ) {
    const message = body.message?.trim();
    if (!message) throw new BadRequestException('请输入消息内容');
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.getProject(projectId, userId);
    const conversationId = await this.projectService.ensureProjectConversation(projectId, userId);
    const chunks: string[] = [];
    for await (const event of this.videoChatService.chat({
      userId,
      projectId,
      conversationId,
      message,
      modelConfigId: body.modelId,
      templateContext: body.templateContext,
    })) {
      if (event.type === 'llm_token' && event.content) chunks.push(event.content);
    }
    return { content: chunks.join('') };
  }
}
