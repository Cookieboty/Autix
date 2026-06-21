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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import {
  VideoProjectService,
  type CreateProjectDto,
  type AddClipDto,
  type UpdateClipDto,
  type AddMaterialDto,
} from './video-project.service';
import { VideoGenerationFlowService } from './video-generation-flow.service';
import { VideoChatService, type VideoDirectorTemplateContext } from './video-chat.service';
import type { AuthUser } from '@autix/domain';

@UseGuards(JwtAuthGuard)
@Controller('video-projects')
export class VideoProjectController {
  constructor(
    private readonly projectService: VideoProjectService,
    private readonly generationFlow: VideoGenerationFlowService,
    private readonly videoChatService: VideoChatService,
  ) { }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateProjectDto) {
    const userId = getCurrentUserId(user);
    return this.projectService.createProject(userId, body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.projectService.getUserProjects(
      userId,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get('workbench/default')
  getWorkbenchDefault(@CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    return this.projectService.getOrCreateWorkbenchProject(userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    return this.projectService.getProject(id, userId);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title?: string; coverImage?: string },
  ) {
    const userId = getCurrentUserId(user);
    return this.projectService.updateProject(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    await this.projectService.deleteProject(id, userId);
  }

  @Post(':id/clips')
  addClip(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: AddClipDto,
  ) {
    const userId = getCurrentUserId(user);
    return this.projectService.addClip(projectId, userId, body);
  }

  @Put(':id/clips/:clipId')
  updateClip(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: UpdateClipDto,
  ) {
    const userId = getCurrentUserId(user);
    return this.projectService.updateClip(projectId, clipId, userId, body);
  }

  @Delete(':id/clips/:clipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClip(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.projectService.deleteClip(projectId, clipId, userId);
  }

  @Put(':id/clips/reorder')
  reorderClips(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: { clipIds: string[] },
  ) {
    const userId = getCurrentUserId(user);
    return this.projectService.reorderClips(projectId, userId, body.clipIds);
  }

  @Post(':id/apply-workflow-template/:templateId')
  async applyWorkflowTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('templateId') templateId: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    const userId = getCurrentUserId(user);
    await this.projectService.getProject(projectId, userId);
    return this.projectService.createStandaloneProjectFromWorkflowTemplate(
      templateId,
      userId,
      body.variables,
    );
  }

  @Post(':id/apply-video-template/:templateId')
  async applyVideoTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('templateId') templateId: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    const userId = getCurrentUserId(user);
    await this.projectService.getProject(projectId, userId);
    return this.projectService.createStandaloneProjectFromVideoTemplate(
      templateId,
      userId,
      body.variables,
    );
  }

  @Post(':id/clips/:clipId/materials')
  addMaterial(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: AddMaterialDto,
  ) {
    const userId = getCurrentUserId(user);
    return this.projectService.addMaterial(projectId, clipId, userId, body);
  }

  @Delete(':id/materials/:materialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMaterial(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('materialId') materialId: string,
  ) {
    const userId = getCurrentUserId(user);
    await this.projectService.removeMaterial(projectId, materialId, userId);
  }

  @Post(':id/clips/:clipId/generate')
  generateClip(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('clipId') _clipId: string,
    @Body() _body: { variantLabel?: string },
  ): Promise<Array<{ generationId: string; taskId: string; clipId: string }>> {
    const userId = getCurrentUserId(user);
    return this.generationFlow.generateAllClips(projectId, userId);
  }

  @Post(':id/generate')
  generateAll(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
  ): Promise<Array<{ generationId: string; taskId: string; clipId: string }>> {
    const userId = getCurrentUserId(user);
    return this.generationFlow.generateAllClips(projectId, userId);
  }

  @Post(':id/generations/:generationId/refresh')
  refresh(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Param('generationId') generationId: string,
  ) {
    const userId = getCurrentUserId(user);
    return this.generationFlow.refreshGeneration({
      projectId,
      generationId,
      userId,
    });
  }

  @Get(':id/generations')
  getGenerations(@CurrentUser() user: AuthUser, @Param('id') projectId: string) {
    const userId = getCurrentUserId(user);
    return this.projectService.getProjectGenerations(projectId, userId);
  }

  @Post(':id/director-chat')
  async directorChat(
    @CurrentUser() user: AuthUser,
    @Param('id') projectId: string,
    @Body() body: { message: string; modelId?: string; templateContext?: VideoDirectorTemplateContext },
  ) {
    const message = body.message?.trim();
    if (!message) throw new BadRequestException('请输入消息内容');
    const userId = getCurrentUserId(user);
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
