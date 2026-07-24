import {
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import {
  AgentKind,
  ModelType,
  TemplateStatus,
  VideoGenStatus,
  VideoProjectStatus,
  VideoClipStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
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
import {
  createVideoShareCode,
  isVideoShareCode,
} from './video-share-token';

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

export interface VideoProjectShareClip {
  id: string;
  order: number;
  title: string | null;
  prompt: string | null;
  durationSec: number | null;
}

export interface VideoProjectShareDetail {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  videoUrl: string;
  thumbnailUrl: string | null;
  lastFrameUrl: string | null;
  generationId: string;
  model: string;
  totalDurationSec: number;
  clips: VideoProjectShareClip[];
}

function badVideoProject(key: string, args?: Record<string, unknown>) {
  return new I18nHttpException(HttpStatus.BAD_REQUEST, key, args, { code: 'BAD_REQUEST' });
}
function notFoundVideoProject(key: string) {
  return new I18nHttpException(HttpStatus.NOT_FOUND, key, undefined, { code: 'NOT_FOUND' });
}
function forbiddenVideoProject(key: string) {
  return new I18nHttpException(HttpStatus.FORBIDDEN, key, undefined, { code: 'FORBIDDEN' });
}
function internalVideoProject(key: string) {
  return new I18nHttpException(HttpStatus.INTERNAL_SERVER_ERROR, key, undefined, {
    code: 'INTERNAL_ERROR',
  });
}

@Injectable()
export class VideoProjectService {
  constructor(
    private readonly repository: VideoProjectRepository,
    private readonly modelConfigService: ModelConfigService,
  ) { }


  private async ensureProjectShareCode(projectId: string, userId: string) {
    const existingShare = await this.repository.findProjectShare(projectId, userId);
    if (existingShare) return existingShare.code;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const share = await this.repository.createProjectShare({
          projectId,
          userId,
          code: createVideoShareCode(),
        });
        return share.code;
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
          ? (error as { code?: unknown }).code
          : null;
        if (code !== 'P2002') throw error;
      }
    }

    throw internalVideoProject('creation.video_project.share_code_gen_failed');
  }

  private readClipDurationSec(params: unknown) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
    const duration = Number((params as Record<string, unknown>).duration);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  }

  private toShareDetail(
    project: NonNullable<Awaited<ReturnType<VideoProjectRepository['findProjectShareDetail']>>>,
  ): VideoProjectShareDetail | null {
    const latestGeneration = project.clips
      .flatMap((clip) => clip.generations)
      .filter((generation) => generation.status === VideoGenStatus.completed && generation.videoUrl)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!latestGeneration?.videoUrl) return null;

    const clips = project.clips.map((clip) => ({
      id: clip.id,
      order: clip.order,
      title: clip.title,
      prompt: clip.prompt,
      durationSec: this.readClipDurationSec(clip.params),
    }));
    const totalDurationSec =
      clips.reduce((sum, clip) => sum + (clip.durationSec ?? 0), 0) ||
      latestGeneration.durationSec ||
      0;

    return {
      id: project.id,
      title: project.title,
      coverImage: project.coverImage,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      videoUrl: latestGeneration.videoUrl,
      thumbnailUrl: latestGeneration.thumbnailUrl,
      lastFrameUrl: latestGeneration.lastFrameUrl,
      generationId: latestGeneration.id,
      model: latestGeneration.model,
      totalDurationSec,
      clips,
    };
  }

  async ensureProjectConversation(projectId: string, userId: string): Promise<string> {
    const project = await this.repository.findProjectConversationInfo(projectId);
    if (!project || project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_access');
    if (project.conversationId) return project.conversationId;

    const conversation = await this.repository.createVideoConversation({
      userId,
      title: project.title,
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
        title: dto.title,
        coverImage: dto.coverImage,
        status: VideoProjectStatus.draft,
      });

      return project;
    }

    if (dto.conversationId) {
      const conv = await this.repository.findConversationForProjectCreation(
        dto.conversationId,
      );
      if (!conv) throw notFoundVideoProject('conversation.not_found');
      if (conv.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_conversation');
      if (conv.videoProject)
        throw badVideoProject('creation.video_project.conversation_already_bound');

      // 兼容老 chat 会话「升级」为 video：仅在当前 kind=chat 且未挂载项目时允许切换
      if (conv.kind !== AgentKind.video) {
        if (conv.kind !== AgentKind.chat) {
          throw badVideoProject(
            'creation.video_project.conversation_kind_unsupported',
            { kind: conv.kind },
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
    if (!project) throw forbiddenVideoProject('creation.video_project.project_not_found');
    if (project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_access');
    return {
      ...project,
      clips: project.clips.map(normalizeClipRecordParams),
    };
  }

  async createProjectShare(projectId: string, userId: string) {
    const project = await this.repository.findProjectShareDetail(projectId);
    if (!project) throw forbiddenVideoProject('creation.video_project.project_not_found');
    if (project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_access');
    if (!this.toShareDetail(project)) {
      throw badVideoProject('creation.video_project.share_no_video');
    }

    return {
      code: await this.ensureProjectShareCode(project.id, project.userId),
    };
  }

  async getSharedProject(code: string) {
    if (!isVideoShareCode(code)) throw notFoundVideoProject('creation.video_project.share_not_found');

    const share = await this.repository.findProjectShareByCode(code);
    if (!share) throw notFoundVideoProject('creation.video_project.share_not_found');

    const project = await this.repository.findProjectShareDetail(share.projectId);
    if (!project || project.userId !== share.userId) {
      throw notFoundVideoProject('creation.video_project.share_not_found');
    }

    const detail = this.toShareDetail(project);
    if (!detail) throw notFoundVideoProject('creation.video_project.share_video_incomplete');
    return detail;
  }

  async getUserProjects(userId: string, page = 1, pageSize = 20) {
    return this.repository.findUserGeneratedProjects(userId, page, pageSize);
  }

  async updateProject(id: string, userId: string, data: { title?: string; coverImage?: string }) {
    const project = await this.repository.findProject(id);
    if (!project) throw forbiddenVideoProject('creation.video_project.project_not_found');
    if (project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_modify');

    return this.repository.updateProject(id, data);
  }

  async deleteProject(id: string, userId: string) {
    const project = await this.repository.findProject(id);
    if (!project) throw forbiddenVideoProject('creation.video_project.project_not_found');
    if (project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_delete');

    await this.repository.deleteProject(id);
  }

  async addClip(projectId: string, userId: string, dto: AddClipDto) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden');

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
    if (!project || project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden');

    const clip = await this.repository.findClip(clipId);
    if (!clip || clip.projectId !== projectId)
      throw badVideoProject('creation.video_project.clip_not_in_project');

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
    if (!project || project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden');

    const clip = await this.repository.findClip(clipId);
    if (!clip || clip.projectId !== projectId)
      throw badVideoProject('creation.video_project.clip_not_in_project');

    await this.repository.deleteClip(clipId);
    await this.repository.renumberProjectClips(projectId);
  }

  async reorderClips(projectId: string, userId: string, clipIds: string[]) {
    const project = await this.repository.findProject(projectId);
    if (!project || project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden');
    const clips = await this.repository.findProjectClipIds(projectId);
    const validIds = new Set(clips.map((clip) => clip.id));
    if (
      clipIds.length !== validIds.size ||
      clipIds.some((clipId) => !validIds.has(clipId))
    ) {
      throw badVideoProject('creation.video_project.clip_reorder_mismatch');
    }

    await this.repository.reorderClips(clipIds);
  }

  async addMaterial(projectId: string, clipId: string, userId: string, dto: AddMaterialDto) {
    const clip = await this.repository.findClipWithProject(clipId);
    if (!clip || clip.project.userId !== userId)
      throw forbiddenVideoProject('creation.video_project.forbidden');
    if (clip.projectId !== projectId)
      throw badVideoProject('creation.video_project.clip_not_in_project');

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
      throw forbiddenVideoProject('creation.video_project.forbidden');
    if (material.clip.projectId !== projectId)
      throw badVideoProject('creation.video_project.material_not_in_project');

    await this.repository.deleteClipMaterial(materialId);
  }

  async createStandaloneProjectFromWorkflowTemplate(
    templateId: string,
    userId: string,
    variables?: Record<string, string>,
  ) {
    const template = await this.repository.findWorkflowTemplate(templateId);
    if (!template) throw notFoundVideoProject('creation.video_project.template_not_found');
    if (template.status !== TemplateStatus.APPROVED) {
      throw forbiddenVideoProject('creation.video_project.template_not_approved');
    }

    const clipDefs = Array.isArray(template.clips)
      ? (template.clips as unknown as WorkflowTemplateClipDefinitionInput[])
      : [];
    if (clipDefs.length === 0) throw badVideoProject('creation.video_project.template_no_clips');

    const defaultVideoModel = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.video,
      userId,
    );

    const clips = buildWorkflowTemplateClips({
      clipDefs,
      variables,
      defaultVideoModelId: defaultVideoModel?.id,
    }).map((clip) => ({
      ...clip,
      params: {
        ...((clip.params ?? {}) as Record<string, unknown>),
        sourceTemplateId: templateId,
        sourceTemplateKind: 'video_workflow_template',
      } as Prisma.InputJsonValue,
    }));

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
    if (!template) throw notFoundVideoProject('creation.video_project.template_not_found');
    if (template.status !== TemplateStatus.APPROVED) {
      throw forbiddenVideoProject('creation.video_project.template_not_approved');
    }

    const resolvedVariables = resolveTemplateVariables(template.variables, variables);
    const prompt = resolvePrompt(template.prompt, resolvedVariables);
    const params = buildSingleClipParams(
      template.defaultParams,
      template.durationSec,
      resolvedVariables,
    );
    params.sourceTemplateId = templateId;
    params.sourceTemplateKind = 'video_template';

    const defaultVideoModel = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.video,
      userId,
    );
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
    if (!project || project.userId !== userId) throw forbiddenVideoProject('creation.video_project.forbidden_access');

    return this.repository.findProjectGenerations(projectId);
  }
}
