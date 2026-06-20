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
  VideoProjectStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ModelConfigService } from '../model-config/model-config.service';

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
    private readonly prisma: PrismaService,
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
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (opts.category) where.category = opts.category;
    if (opts.status) where.status = opts.status;
    else where.status = TemplateStatus.APPROVED;

    const [items, total] = await Promise.all([
      this.prisma.video_workflow_templates.findMany({
        where,
        orderBy: { useCount: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.video_workflow_templates.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async findById(id: string) {
    const tpl = await this.prisma.video_workflow_templates.findUnique({
      where: { id },
    });
    if (!tpl) throw new ForbiddenException('模板不存在');
    return tpl;
  }

  async create(authorId: string, dto: CreateWorkflowTemplateDto) {
    return this.prisma.video_workflow_templates.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        coverImage: dto.coverImage,
        tags: dto.tags ?? [],
        clips: dto.clips as object,
        authorId,
        pointsCost: dto.pointsCost ?? 0,
        status: TemplateStatus.PENDING,
      },
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
      const conv = await this.prisma.conversations.findUnique({
        where: { id: conversationIdInput },
        select: {
          id: true,
          userId: true,
          kind: true,
          videoProject: { select: { id: true } },
        },
      });
      if (!conv) throw new NotFoundException('会话不存在');
      if (conv.userId !== userId) throw new ForbiddenException('无权操作此会话');
      if (conv.videoProject) throw new BadRequestException('该会话已绑定视频项目');
      if (conv.kind !== AgentKind.video) {
        if (conv.kind !== AgentKind.chat) {
          throw new BadRequestException(`会话 kind=${conv.kind}，无法用于创建视频项目`);
        }
        await this.prisma.conversations.update({
          where: { id: conv.id },
          data: { kind: AgentKind.video },
        });
      }
      conversationId = conv.id;
    } else {
      const conversation = await this.prisma.conversations.create({
        data: { userId, title: tpl.title, kind: AgentKind.video },
      });
      conversationId = conversation.id;
    }

    const project = await this.prisma.video_projects.create({
      data: {
        userId,
        title: tpl.title,
        coverImage: tpl.coverImage,
        conversationId,
        status: VideoProjectStatus.draft,
      },
    });

    // Plan-2: 模板克隆时若 defaultParams 未指定 modelConfigId，注入默认视频模型
    const defaultVideoModel = await this.modelConfigService.findDefaultByType(
      ModelType.video,
    );
    if (!defaultVideoModel) {
      this.logger.warn(
        '未找到默认视频模型（type=video, isDefault=true），克隆出的 clip 将以 modelConfigId=undefined 落库，generate 时会再次 fallback 失败',
      );
    }

    for (const clipDef of clipDefs) {
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

      await this.prisma.video_clips.create({
        data: {
          projectId: project.id,
          order: clipDef.order,
          title: clipDef.title,
          prompt,
          params: mergedParams as object,
          chainFromPrev: clipDef.chainFromPrevious,
          status: VideoClipStatus.pending,
        },
      });
    }

    await this.prisma.video_workflow_templates.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    return project;
  }
}
