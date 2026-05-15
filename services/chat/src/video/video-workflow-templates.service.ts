import { Injectable, ForbiddenException } from '@nestjs/common';
import { TemplateStatus, VideoClipStatus, VideoProjectStatus } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
  ) {
    const tpl = await this.findById(templateId);
    const clipDefs = tpl.clips as unknown as WorkflowClipDefinition[];

    const conversation = await this.prisma.conversations.create({
      data: { userId, title: tpl.title },
    });

    const project = await this.prisma.video_projects.create({
      data: {
        userId,
        title: tpl.title,
        coverImage: tpl.coverImage,
        conversationId: conversation.id,
        status: VideoProjectStatus.draft,
      },
    });

    for (const clipDef of clipDefs) {
      let prompt = clipDef.promptTemplate;
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          prompt = prompt.replaceAll(`{{${key}}}`, value);
        }
      }

      await this.prisma.video_clips.create({
        data: {
          projectId: project.id,
          order: clipDef.order,
          title: clipDef.title,
          prompt,
          params: clipDef.defaultParams as object,
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
