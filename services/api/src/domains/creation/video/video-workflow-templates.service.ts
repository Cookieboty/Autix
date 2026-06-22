import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
  private readonly logger = new Logger(VideoWorkflowTemplatesService.name);

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
    if (!tpl) throw new ForbiddenException('模板不存在');
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
      if (!conv) throw new NotFoundException('会话不存在');
      if (conv.userId !== userId) throw new ForbiddenException('无权操作此会话');
      if (conv.videoProject) throw new BadRequestException('该会话已绑定视频项目');
      if (conv.kind !== AgentKind.video) {
        if (conv.kind !== AgentKind.chat) {
          throw new BadRequestException(`会话 kind=${conv.kind}，无法用于创建视频项目`);
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
        '未找到默认视频模型（type=video, isDefault=true），克隆出的 clip 将以 modelConfigId=undefined 落库，generate 时会再次 fallback 失败',
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
