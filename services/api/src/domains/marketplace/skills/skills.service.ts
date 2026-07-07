import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  type Prisma,
} from '../../platform/prisma/generated';
import { BaseResourceService } from '../../platform/common/base-resource.service';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { RuntimeDetectorService } from '../../platform/common/runtime-detector.service';
import { parseSkillMarkdown } from '../../platform/common/skill-markdown.parser';
import { ResourceMetricsService } from '../../platform/resource-metrics/resource-metrics.service';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';

export interface CreateSkillDto {
  title?: string;
  description?: string;
  category: string;
  rawMarkdown?: string;
  sourceFormat?: string;
  instructions?: string;
  frontmatter?: Record<string, unknown>;
  variables?: unknown[];
  coverImage?: string;
  exampleMedia?: string[];
  modelHint?: string;
  tags?: string[];
  pointsCost?: number;
  // 作者显式声明运行时(覆盖 AUTO 检测结果)
  runtimeRequirement?: RuntimeReq;
}

export type UpdateSkillDto = Partial<CreateSkillDto>;

@Injectable()
export class SkillsService extends BaseResourceService {
  constructor(
    resourceInteractions: ResourceInteractionRepository,
    private readonly repository: MarketplaceResourceCrudRepository,
    private readonly detector: RuntimeDetectorService,
    resourceMetrics: ResourceMetricsService,
  ) {
    super(resourceInteractions, resourceMetrics);
  }

  protected get delegate() {
    return this.repository.delegateFor(ResourceType.SKILL);
  }

  protected get resourceType(): ResourceType {
    return ResourceType.SKILL;
  }

  async create(authorId: string, dto: CreateSkillDto) {
    const parsed = dto.rawMarkdown
      ? parseSkillMarkdown(dto.rawMarkdown)
      : undefined;
    const instructions = parsed?.instructions ?? dto.instructions;
    if (!instructions?.trim()) {
      throw new BadRequestException('Skill instructions 不能为空');
    }
    const frontmatter = parsed?.frontmatter ?? dto.frontmatter ?? {};

    const detection = await this.detector.detectSkill({
      instructions,
      frontmatter,
    });

    // SUSPECTED_DESKTOP 必须由作者显式选择 → 强制要求 runtimeRequirement
    if (detection.level === 'SUSPECTED_DESKTOP' && !dto.runtimeRequirement) {
      throw new BadRequestException({
        code: 'SUSPECTED_DESKTOP',
        message: detection.reason,
      });
    }

    const runtimeRequirement =
      dto.runtimeRequirement ?? (detection.level as RuntimeReq);
    const runtimeDetectedBy = dto.runtimeRequirement
      ? DetectionSrc.AUTHOR
      : DetectionSrc.AUTO;

    return this.repository.createSkill({
      title: dto.title?.trim() || parsed?.title || 'Untitled Skill',
      description: dto.description ?? parsed?.description,
      category: dto.category,
      rawMarkdown: dto.rawMarkdown,
      sourceFormat: dto.sourceFormat ?? (dto.rawMarkdown ? 'skill_md' : 'structured'),
      parsedFrontmatter: parsed?.frontmatter ? this.toJson(parsed.frontmatter) : undefined,
      instructions,
      frontmatter: this.toJson(frontmatter),
      variables: this.toJson(dto.variables ?? []),
      coverImage: dto.coverImage,
      exampleMedia: dto.exampleMedia ?? [],
      modelHint: dto.modelHint ?? parsed?.modelHint,
      tags: dto.tags ?? parsed?.tags ?? [],
      pointsCost: dto.pointsCost ?? 0,
      runtimeRequirement,
      runtimeDetectedBy,
      runtimeReason: detection.reason,
      authorId,
      status: TemplateStatus.PENDING,
    });
  }

  async update(id: string, userId: string, dto: UpdateSkillDto) {
    const skill = (await this.findById(id)) as {
      authorId: string;
      instructions: string;
      frontmatter: Record<string, unknown>;
      rawMarkdown?: string | null;
      runtimeDetectedBy: DetectionSrc;
    };
    if (skill.authorId !== userId) throw new ForbiddenException('无权修改此 Skill');

    const parsed = dto.rawMarkdown
      ? parseSkillMarkdown(dto.rawMarkdown)
      : undefined;
    const nextInstructions = parsed?.instructions ?? dto.instructions;
    const nextFrontmatter = parsed?.frontmatter ?? dto.frontmatter;

    const data: Prisma.skillsUncheckedUpdateInput = {
      ...dto,
      title: dto.title?.trim() || parsed?.title || undefined,
      description: dto.description ?? parsed?.description,
      rawMarkdown: dto.rawMarkdown,
      sourceFormat: dto.sourceFormat ?? (dto.rawMarkdown ? 'skill_md' : undefined),
      parsedFrontmatter: parsed?.frontmatter ? this.toJson(parsed.frontmatter) : undefined,
      instructions: nextInstructions,
      frontmatter: nextFrontmatter ? this.toJson(nextFrontmatter) : undefined,
      variables: dto.variables ? this.toJson(dto.variables) : undefined,
      modelHint: dto.modelHint ?? parsed?.modelHint,
      tags: dto.tags ?? parsed?.tags,
      status: TemplateStatus.PENDING,
    };

    // 内容变更 → 重跑 AUTO 检测(但不覆盖 AUTHOR/ADMIN 决策)
    if (
      (dto.instructions !== undefined ||
        dto.frontmatter !== undefined ||
        dto.rawMarkdown !== undefined) &&
      skill.runtimeDetectedBy === DetectionSrc.AUTO
    ) {
      const detection = await this.detector.detectSkill({
        instructions: nextInstructions ?? skill.instructions,
        frontmatter: (nextFrontmatter ?? skill.frontmatter) as Record<
          string,
          unknown
        >,
      });
      if (detection.level === 'SUSPECTED_DESKTOP' && !dto.runtimeRequirement) {
        throw new BadRequestException({
          code: 'SUSPECTED_DESKTOP',
          message: detection.reason,
        });
      }
      data.runtimeRequirement = (dto.runtimeRequirement ??
        detection.level) as RuntimeReq;
      data.runtimeDetectedBy = dto.runtimeRequirement
        ? DetectionSrc.AUTHOR
        : DetectionSrc.AUTO;
      data.runtimeReason = detection.reason;
    } else if (dto.runtimeRequirement) {
      data.runtimeRequirement = dto.runtimeRequirement;
      data.runtimeDetectedBy = DetectionSrc.AUTHOR;
    }

    return this.repository.updateSkill(id, data);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
