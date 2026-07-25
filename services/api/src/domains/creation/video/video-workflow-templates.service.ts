import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { AppLogger } from '../../platform/common/app-logger';
import {
  AgentKind,
  ModelType,
  TemplateStatus,
  VideoClipStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { ModelConfigService } from '../model-config/model-config.service';
import {
  type VideoTemplateClipCreateInput,
} from './video-project.repository';
import { VideoWorkflowTemplateRepository } from './video-workflow-template.repository';

export interface WorkflowClipDefinition {
  order: number;
  title?: string;
  promptTemplate: string;
  defaultParams: Record<string, unknown>;
  materialSlots: Array<{
    role: string;
    required: boolean;
    label: string;
    maxCount?: number;
  }>;
  chainFromPrevious: boolean;
}

export interface CreateWorkflowTemplateDto {
  title: string;
  description?: string;
  category: string;
  coverImage?: string;
  tags?: string[];
  clips: WorkflowClipDefinition[];
  pointsCost?: number;
}

@Injectable()
export class VideoWorkflowTemplatesService {
  private readonly logger = new AppLogger(VideoWorkflowTemplatesService.name);

  constructor(
    private readonly repository: VideoWorkflowTemplateRepository,
    private readonly modelConfigService: ModelConfigService,
  ) { }

  async findAll(opts: {
    category?: string;
    status?: TemplateStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    return this.repository.findAll({
      category: opts.category,
      status: opts.status ?? TemplateStatus.APPROVED,
      page,
      pageSize,
    });
  }

  async findById(id: string) {
    const tpl = await this.repository.findById(id);
    if (!tpl) throw new I18nHttpException(HttpStatus.FORBIDDEN, 'creation.video_project.template_not_found');
    return tpl;
  }

  async create(authorId: string, dto: CreateWorkflowTemplateDto) {
    return this.repository.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      coverImage: dto.coverImage,
      tags: dto.tags ?? [],
      clips: dto.clips as unknown as Prisma.InputJsonValue,
      authorId,
      pointsCost: dto.pointsCost ?? 0,
    });
  }

  async createProjectFromTemplate(
    templateId: string,
    userId: string,
    variables?: Record<string, string>,
    conversationIdInput?: string,
  ) {
    const tpl = await this.findById(templateId);
    const clipDefs = tpl.clips as unknown as WorkflowClipDefinition[];

    let conversationId: string;
    if (conversationIdInput) {
      const conv =
        await this.repository.findConversationForProjectCreation(
          conversationIdInput,
        );
      if (!conv) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'conversation.not_found');
      if (conv.userId !== userId) throw new I18nHttpException(HttpStatus.FORBIDDEN, 'creation.video_project.forbidden_conversation');
      if (conv.videoProject) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.video_project.conversation_already_bound');
      if (conv.kind !== AgentKind.video) {
        if (conv.kind !== AgentKind.chat) {
          throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.video_project.conversation_kind_unsupported', { kind: conv.kind });
        }
        await this.repository.updateConversationKind(conv.id, AgentKind.video);
      }
      conversationId = conv.id;
    } else {
      const conversation = await this.repository.createVideoConversation({
        userId,
        title: tpl.title,
      });
      conversationId = conversation.id;
    }

    // 模板克隆时若 defaultParams 未指定 modelConfigId，注入默认视频模型。
    const defaultVideoModel = await this.modelConfigService.findDefaultByTypeForUser(
      ModelType.video,
      userId,
    );
    if (!defaultVideoModel) {
      this.logger.warn(
        'No default video model found (type=video, isDefault=true); cloned clips will be persisted with modelConfigId=undefined, and generate will fail on fallback again',
      );
    }

    const clips: VideoTemplateClipCreateInput[] = clipDefs.map((clipDef) => {
      let prompt = clipDef.promptTemplate;
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          prompt = prompt.replaceAll(`{{${key}}}`, value);
        }
      }

      const mergedParams: Record<string, unknown> = {
        ...(clipDef.defaultParams ?? {}),
      };
      if (!mergedParams.modelConfigId && defaultVideoModel) {
        mergedParams.modelConfigId = defaultVideoModel.id;
      }

      return {
        order: clipDef.order,
        title: clipDef.title,
        prompt,
        params: mergedParams as Prisma.InputJsonValue,
        chainFromPrev: clipDef.chainFromPrevious,
        status: VideoClipStatus.pending,
      };
    });

    return this.repository.createProjectWithClipsFromTemplate({
      templateId,
      userId,
      title: tpl.title,
      coverImage: tpl.coverImage,
      conversationId,
      clips,
    });
  }
}
