import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudflareR2Service } from '../storage/cloudflare-r2.service';
import { TemplateStatus } from '@prisma/client';

export interface CreateTemplateDto {
  title: string;
  description?: string;
  category: string;
  prompt: string;
  variables: Array<{
    key: string;
    label: string;
    type: string;
    default?: string;
    options?: string[];
  }>;
  coverImage?: string;
  exampleImages?: string[];
  modelHint?: string;
  tags?: string[];
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {}

export interface ListTemplatesQuery {
  category?: string;
  status?: TemplateStatus;
  authorId?: string;
  search?: string;
  sort?: 'newest' | 'popular' | 'likes';
  page?: number;
  pageSize?: number;
}

export interface ReviewDto {
  action: 'approve' | 'reject' | 'revise';
  reason?: string;
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: CloudflareR2Service,
  ) {}

  // ── Template CRUD ───────────────────────────────────────────────────────

  async create(authorId: string, dto: CreateTemplateDto) {
    return this.prisma.prompt_templates.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        prompt: dto.prompt,
        variables: dto.variables as any,
        coverImage: dto.coverImage,
        exampleImages: dto.exampleImages ?? [],
        modelHint: dto.modelHint,
        tags: dto.tags ?? [],
        authorId,
        status: TemplateStatus.PENDING,
      },
    });
  }

  async findAll(query: ListTemplatesQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.category) where.category = query.category;
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = TemplateStatus.APPROVED;
    }
    if (query.authorId) where.authorId = query.authorId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (query.sort === 'popular') orderBy = { useCount: 'desc' };
    if (query.sort === 'likes') orderBy = { likeCount: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.prompt_templates.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.prompt_templates.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async findById(id: string) {
    const tpl = await this.prisma.prompt_templates.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('模板不存在');
    return tpl;
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    const tpl = await this.findById(id);
    if (tpl.authorId !== userId) throw new ForbiddenException('无权修改此模板');

    return this.prisma.prompt_templates.update({
      where: { id },
      data: {
        ...dto,
        variables: dto.variables as any,
        status: TemplateStatus.PENDING,
      },
    });
  }

  async remove(id: string, userId: string) {
    const tpl = await this.findById(id);
    if (tpl.authorId !== userId) throw new ForbiddenException('无权删除此模板');
    return this.prisma.prompt_templates.delete({ where: { id } });
  }

  async like(id: string) {
    await this.findById(id);
    return this.prisma.prompt_templates.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    });
  }

  // ── Admin Review ────────────────────────────────────────────────────────

  async findForReview(query: { status?: TemplateStatus; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.prompt_templates.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.prompt_templates.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async review(id: string, dto: ReviewDto) {
    const tpl = await this.findById(id);

    const data: any = {};
    switch (dto.action) {
      case 'approve':
        data.status = TemplateStatus.APPROVED;
        data.publishedAt = new Date();
        data.rejectReason = null;
        break;
      case 'reject':
        data.status = TemplateStatus.REJECTED;
        data.rejectReason = dto.reason ?? null;
        break;
      case 'revise':
        data.status = TemplateStatus.PENDING;
        data.rejectReason = dto.reason ?? null;
        break;
    }

    return this.prisma.prompt_templates.update({ where: { id }, data });
  }

  // ── Generations ─────────────────────────────────────────────────────────

  resolvePrompt(promptTemplate: string, variables: Record<string, string>): string {
    let resolved = promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      resolved = resolved.replaceAll(`{{${key}}}`, value);
    }
    return resolved;
  }

  async createGeneration(
    templateId: string,
    userId: string,
    data: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
    },
  ) {
    const tpl = await this.findById(templateId);
    const resolvedPrompt = this.resolvePrompt(tpl.prompt, data.variables);

    await this.prisma.prompt_templates.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    return this.prisma.template_generations.create({
      data: {
        templateId,
        userId,
        modelUsed: data.modelUsed,
        resolvedPrompt,
        variables: data.variables as any,
        referenceImage: data.referenceImage,
        status: 'pending',
      },
    });
  }

  async findGeneration(id: string, userId: string) {
    const gen = await this.prisma.template_generations.findUnique({
      where: { id },
      include: { turns: { orderBy: { createdAt: 'asc' } }, template: true },
    });
    if (!gen) throw new NotFoundException('生成记录不存在');
    if (gen.userId !== userId) throw new ForbiddenException('无权访问');
    return gen;
  }

  async updateGeneration(id: string, data: {
    generatedImages?: string[];
    status?: string;
    error?: string;
    durationMs?: number;
  }) {
    return this.prisma.template_generations.update({ where: { id }, data });
  }

  async addTurn(generationId: string, data: {
    role: 'USER' | 'ASSISTANT';
    content: string;
    images?: string[];
  }) {
    return this.prisma.generation_turns.create({
      data: {
        generationId,
        role: data.role,
        content: data.content,
        images: data.images ?? [],
      },
    });
  }

  async findMyGenerations(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.template_generations.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { template: { select: { title: true, coverImage: true, category: true } } },
      }),
      this.prisma.template_generations.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async uploadBase64Image(base64: string, folder: string): Promise<string> {
    const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid base64 image');
    const [, ext, data] = match;
    const buffer = Buffer.from(data, 'base64');
    const result = await this.r2.uploadBuffer(buffer, {
      contentType: `image/${ext}`,
      folder,
      ext,
    });
    return result.publicUrl;
  }
}
