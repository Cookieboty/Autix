import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AgentKind,
  ModelType,
  TemplateStatus,
  VideoProjectStatus,
  VideoClipStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { ModelConfigService } from '../model-config/model-config.service';
import {
  buildSingleClipParams,
  buildWorkflowTemplateClips,
  normalizeClipParams,
  normalizeClipRecordParams,
  resolvePrompt,
  resolveTemplateVariables,
  type WorkflowTemplateClipDefinitionInput,
} from './video-project.helpers';
import { VideoProjectRepository } from './video-project.repository';

export interface CreateProjectDto {
  title: string;
  coverImage?: string;
  conversationId?: string;
  standalone?: boolean;
}

export interface AddClipDto {
  title?: string;
  prompt?: string;
  params: Record<string, unknown>;
  chainFromPrev?: boolean;
}

export interface UpdateClipDto {
  title?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  chainFromPrev?: boolean;
}

export interface AddMaterialDto {
  role: 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio';
  sourceType: 'upload' | 'image_generation' | 'video_generation' | 'platform_asset';
  sourceId?: string;
  url: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class VideoProjectService {
  constructor(
    private readonly repository: VideoProjectRepository,
    private readonly modelConfigService: ModelConfigService,
  ) { }

  private readonly workbenchProjectTitle = '专业视频工作台';
  private readonly workbenchConversationTitle = '专业视频工作台';

  async getOrCreateWorkbenchProject(userId: string) {
    const latestStoryboardOnlyProject =
      await this.repository.findLatestStoryboardOnlyProject(userId);

    if (latestStoryboardOnlyProject) return this.getProject(latestStoryboardOnlyProject.id, userId);
    return null;
  }

  async ensureProjectConversation(projectId: string, userId: string): Promise<string> {
    const project = await this.repository.findProjectConversationInfo(projectId);
    if (!project || project.userId !== userId) throw new ForbiddenException('无权访问');
    if (project.conversationId) return project.conversationId;

    const conversation = await this.repository.createVideoConversation({
      userId,
      title: project.title || this.workbenchConversationTitle,
    });
    await this.repository.assignConversation(projectId, conversation.id);
    return conversation.id;
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    // video_project 必挂 conversation；支持复用已有 conversation（须为 video kind 且 owner 一致），否则建一条 kind=video 的新 conversation
    let conversationId: string | undefined;

    if (dto.standalone) {
      const project = await this.repository.createProject({
        userId,
        title: dto.title || this.workbenchProjectTitle,
        coverImage: dto.coverImage,
        status: VideoProjectStatus.draft,
      });

      return project;
    }

    if (dto.conversationId) {
      const conv = await this.repository.findConversationForProjectCreation(
        dto.conversationId,
      );
      if (!conv) throw new NotFoundException('会话不存在');
      if (conv.userId !== userId) throw new ForbiddenException('无权操作此会话');
      if (conv.videoProject)
        throw new BadRequestException('该会话已绑定视频项目');

      // 兼容老 chat 会话「升级」为 video：仅在当前 kind=chat 且未挂载项目时允许切换
      if (conv.kind !== AgentKind.video) {
        if (conv.kind !== AgentKind.chat) {
          throw new BadRequestException(
            `会话 kind=${conv.kind}，无法用于创建视频项目`,
          );
        }
        await this.repository.updateConversationKind(conv.id, AgentKind.video);
      }
      conversationId = conv.id;
    } else {
      const conversation = await this.repository.createVideoConversation({
        userId,
        title: dto.title,
      });
      conversationId = conversation.id;
    }

    const project = await this.repository.createProject({
      userId,
      title: dto.title,
      coverImage: dto.coverImage,
      conversationId,
      status: VideoProjectStatus.draft,
    });

    return project;
  }

  async getProject(id: string, userId: string) {
    const project = await this.repository.findProjectDetail(id);
    if (!project) throw new ForbiddenException('项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('无权访问');
    return {
      ...project,
      clips: project.clips.map(normalizeClipRecordParams),
    };
  }

  async getUserProjects(userId: string, page = 1, pageSize = 20) {
    return this.repository.findUserGeneratedProjects(userId, page, pageSize);
  }

  async updateProject(id: string, userId: string, data: { title?: string; coverImage?: string }) {
    const project = await this.repository.findProject(id);
    if (!project) throw new ForbiddenException('项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('无权修改');

    return this.repository.updateProject(id, data);
  }

  async deleteProject(id: string, userId: string) {
    const project = await this.repository.findProject(id);
    if (!project) throw new ForbiddenException('项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('无权删除');

    await this.repository.deleteProject(id);
  }

  async addClip(projectId: string, userId: string, dto: AddClipDto) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    const order = await this.repository.findNextClipOrder(projectId);

    return this.repository.createClip({
      projectId,
      order,
      title: dto.title,
      prompt: dto.prompt,
      params: normalizeClipParams(dto.params) as Prisma.InputJsonValue,
      chainFromPrev: dto.chainFromPrev ?? false,
      status: VideoClipStatus.pending,
    });
  }

  async updateClip(projectId: string, clipId: string, userId: string, dto: UpdateClipDto) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    const clip = await this.repository.findClip(clipId);
    if (!clip || clip.projectId !== projectId)
      throw new BadRequestException('Clip 不属于此项目');

    return this.repository.updateClip(clipId, {
      title: dto.title,
      prompt: dto.prompt,
      params: dto.params
        ? (normalizeClipParams(dto.params) as Prisma.InputJsonValue)
        : undefined,
      chainFromPrev: dto.chainFromPrev,
    });
  }

  async deleteClip(projectId: string, clipId: string, userId: string) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    const clip = await this.repository.findClip(clipId);
    if (!clip || clip.projectId !== projectId)
      throw new BadRequestException('Clip 不属于此项目');

    await this.repository.deleteClip(clipId);
    await this.repository.renumberProjectClips(projectId);
  }

  async reorderClips(projectId: string, userId: string, clipIds: string[]) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');
    const clips = await this.repository.findProjectClipIds(projectId);
    const validIds = new Set(clips.map((clip) => clip.id));
    if (
      clipIds.length !== validIds.size ||
      clipIds.some((clipId) => !validIds.has(clipId))
    ) {
      throw new BadRequestException('Clip 顺序与项目不匹配');
    }

    await this.repository.reorderClips(clipIds);
  }

  async addMaterial(projectId: string, clipId: string, userId: string, dto: AddMaterialDto) {
    const clip = await this.repository.findClipWithProject(clipId);
    if (!clip || clip.project.userId !== userId)
      throw new ForbiddenException('无权操作');
    if (clip.projectId !== projectId)
      throw new BadRequestException('Clip 不属于此项目');

    return this.repository.createClipMaterial({
      clipId,
      role: dto.role,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      url: dto.url,
      name: dto.name,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  async removeMaterial(projectId: string, materialId: string, userId: string) {
    const material = await this.repository.findMaterialWithProject(materialId);
    if (!material || material.clip.project.userId !== userId)
      throw new ForbiddenException('无权操作');
    if (material.clip.projectId !== projectId)
      throw new BadRequestException('素材不属于此项目');

    await this.repository.deleteClipMaterial(materialId);
  }

  async createStandaloneProjectFromWorkflowTemplate(
    templateId: string,
    userId: string,
    variables?: Record<string, string>,
  ) {
    const template = await this.repository.findWorkflowTemplate(templateId);
    if (!template) throw new NotFoundException('模板不存在');
    if (template.status !== TemplateStatus.APPROVED) {
      throw new ForbiddenException('模板尚未通过审核，无法套用');
    }

    const clipDefs = Array.isArray(template.clips)
      ? (template.clips as unknown as WorkflowTemplateClipDefinitionInput[])
      : [];
    if (clipDefs.length === 0) throw new BadRequestException('模板没有可套用的分镜');

    const defaultVideoModel = await this.modelConfigService.findDefaultByType(ModelType.video);

    const clips = buildWorkflowTemplateClips({
      clipDefs,
      variables,
      defaultVideoModelId: defaultVideoModel?.id,
    });

    const project =
      await this.repository.createStandaloneProjectFromWorkflowTemplate({
        templateId,
        userId,
        title: template.title,
        coverImage: template.coverImage,
        clips,
      });

    return this.getProject(project.id, userId);
  }

  async createStandaloneProjectFromVideoTemplate(
    templateId: string,
    userId: string,
    variables?: Record<string, string>,
  ) {
    const template = await this.repository.findVideoTemplate(templateId);
    if (!template) throw new NotFoundException('模板不存在');
    if (template.status !== TemplateStatus.APPROVED) {
      throw new ForbiddenException('模板尚未通过审核，无法套用');
    }

    const resolvedVariables = resolveTemplateVariables(template.variables, variables);
    const prompt = resolvePrompt(template.prompt, resolvedVariables);
    const params = buildSingleClipParams(
      template.defaultParams,
      template.durationSec,
      resolvedVariables,
    );

    const defaultVideoModel = await this.modelConfigService.findDefaultByType(ModelType.video);
    if (!params.modelConfigId && defaultVideoModel) {
      params.modelConfigId = defaultVideoModel.id;
    }

    const project =
      await this.repository.createStandaloneProjectFromVideoTemplate({
        templateId,
        userId,
        title: template.title,
        coverImage: template.coverImage,
        clip: {
          order: 1,
          title: template.title,
          prompt,
          params: params as Prisma.InputJsonValue,
          chainFromPrev: false,
          status: VideoClipStatus.pending,
        },
      });

    return this.getProject(project.id, userId);
  }

  async getProjectGenerations(projectId: string, userId: string) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw new ForbiddenException('无权访问');

    return this.repository.findProjectGenerations(projectId);
  }
}
