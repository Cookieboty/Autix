import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  type Prisma,
} from '../../platform/prisma/generated';
import { randomUUID } from 'crypto';
import { PointsService } from '../../billing/points/points.service';
import { MembershipService } from '../../billing/membership/membership.service';
import { ModelConfigService } from '../../creation/model-config/model-config.service';
import { BaseResourceService } from '../../platform/common/base-resource.service';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';
import { TemplateGenerationRepository } from '../template-generation.repository';

export interface CreateVideoTemplateDto {
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
  exampleMedia?: string[];
  modelHint?: string;
  durationSec?: number;
  defaultParams?: Record<string, unknown>;
  materialSlots?: Array<{
    role: string;
    label: string;
    required: boolean;
  }>;
  tags?: string[];
  pointsCost?: number;
}

export type UpdateVideoTemplateDto = Partial<CreateVideoTemplateDto>;

@Injectable()
export class VideoTemplatesService extends BaseResourceService {
  private readonly logger = new Logger(VideoTemplatesService.name);

  constructor(
    resourceInteractions: ResourceInteractionRepository,
    private readonly resources: MarketplaceResourceCrudRepository,
    private readonly pointsService: PointsService,
    private readonly modelConfigService: ModelConfigService,
    private readonly generations: TemplateGenerationRepository,
    private readonly membershipService: MembershipService,
  ) {
    super(resourceInteractions);
  }

  protected get delegate() {
    return this.resources.delegateFor(ResourceType.VIDEO_TEMPLATE);
  }

  protected get resourceType(): ResourceType {
    return ResourceType.VIDEO_TEMPLATE;
  }

  async exportForAdmin(where: Prisma.video_templatesWhereInput) {
    return this.resources.findVideoTemplates(where);
  }

  async create(authorId: string, dto: CreateVideoTemplateDto) {
    return this.resources.createVideoTemplate({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      prompt: dto.prompt,
      variables: this.toJson(dto.variables),
      coverImage: dto.coverImage,
      exampleMedia: dto.exampleMedia ?? [],
      modelHint: dto.modelHint,
      durationSec: dto.durationSec,
      defaultParams: dto.defaultParams as Prisma.InputJsonValue | undefined,
      materialSlots: dto.materialSlots as Prisma.InputJsonValue | undefined,
      tags: dto.tags ?? [],
      pointsCost: dto.pointsCost ?? 0,
      runtimeRequirement: RuntimeReq.CLOUD,
      runtimeDetectedBy: DetectionSrc.AUTO,
      runtimeReason: '视频模板恒定云端运行',
      authorId,
      status: TemplateStatus.PENDING,
    });
  }

  async update(id: string, userId: string, dto: UpdateVideoTemplateDto) {
    const tpl = (await this.findById(id)) as { authorId: string };
    if (tpl.authorId !== userId) throw new ForbiddenException('无权修改此模板');

    const { variables, defaultParams, materialSlots, ...rest } = dto;

    return this.resources.updateVideoTemplate(id, {
      ...rest,
      variables: variables ? this.toJson(variables) : undefined,
      defaultParams: defaultParams ? this.toJson(defaultParams) : undefined,
      materialSlots: materialSlots ? this.toJson(materialSlots) : undefined,
      status: TemplateStatus.PENDING,
    });
  }

  async createGeneration(
    templateId: string,
    userId: string,
    data: {
      modelUsed: string;
      variables: Record<string, string>;
      referenceImage?: string;
      modelConfigId?: string;
    },
  ) {
    const tpl = (await this.findById(templateId)) as {
      prompt: string;
      title?: string;
      durationSec?: number | null;
      defaultParams?: Record<string, unknown> | null;
    };
    const resolvedPrompt = this.resolvePrompt(tpl.prompt, data.variables);
    const generationId = randomUUID();

    const modelConfig = data.modelConfigId
      ? await this.modelConfigService
          .getConfigForOrchestrator(data.modelConfigId)
          .catch(() => null)
      : null;
    const isOwnModel = modelConfig?.createdBy === userId;

    let holdId: string | null = null;
    if (!isOwnModel) {
      const membershipLevel = await this.membershipService.resolveActiveMembershipLevel(userId);
      const estimate = await this.estimateTemplateGenerationCost({
        taskType: 'video_generation',
        modelProvider: modelConfig?.provider ?? undefined,
        modelName: modelConfig?.model ?? data.modelUsed,
        seconds: tpl.durationSec ?? undefined,
        resolution: typeof tpl.defaultParams?.resolution === 'string'
          ? tpl.defaultParams.resolution
          : undefined,
        referenceImages: data.referenceImage ? 1 : 0,
        membershipLevel,
      });

      if (estimate.amount > 0) {
        const { hold } = await this.pointsService.createHold(userId, {
          taskType: estimate.taskType,
          taskId: generationId,
          amount: estimate.amount,
          pricingSnapshot: estimate.pricingSnapshot,
          refundPolicySnapshot: estimate.refundPolicySnapshot,
          metadata: this.toJson({
            templateId,
            modelUsed: data.modelUsed,
            variables: data.variables,
            durationSec: tpl.durationSec ?? null,
            referenceImage: data.referenceImage ?? null,
          }),
          remark: `video-template-generation: ${tpl.title ?? templateId}`,
        });
        holdId = hold.id;
      }
    }

    try {
      const gen = await this.generations.createVideoGeneration({
        id: generationId,
        templateId,
        userId,
        modelUsed: data.modelUsed,
        resolvedPrompt,
        variables: this.toJson(data.variables),
        referenceImage: data.referenceImage,
      });

      if (holdId) {
        await this.pointsService.confirmHold(holdId);
      }
      return gen;
    } catch (err) {
      if (holdId) {
        try {
          await this.pointsService.refundHold(
            holdId,
            'video template generation creation failed',
          );
        } catch (refundErr) {
          this.logger.warn(
            `视频模板生成冻结退回失败 hold=${holdId}: ${String(
              refundErr instanceof Error ? refundErr.message : refundErr,
            )}`,
          );
        }
      }
      throw err;
    }
  }

  async findGeneration(id: string, userId: string) {
    const gen = await this.generations.findVideoGeneration(id);
    if (!gen) throw new ForbiddenException('生成记录不存在');
    if (gen.userId !== userId) throw new ForbiddenException('无权访问');

    const turns = await this.generations.findTurns(ResourceType.VIDEO_TEMPLATE, id);
    return { ...gen, turns };
  }

  async addTurn(
    generationId: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) {
    return this.generations.addTurn(
      ResourceType.VIDEO_TEMPLATE,
      generationId,
      data,
    );
  }

  async findMyGenerations(userId: string, page = 1, pageSize = 20) {
    return this.generations.findVideoGenerationsByUser(userId, page, pageSize);
  }

  resolvePrompt(
    promptTemplate: string,
    variables: Record<string, string>,
  ): string {
    let resolved = promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      resolved = resolved.replaceAll(`{{${key}}}`, value);
    }
    return resolved;
  }

  private async estimateTemplateGenerationCost(input: {
    taskType: string;
    modelProvider?: string;
    modelName?: string;
    seconds?: number;
    resolution?: string;
    referenceImages?: number;
    membershipLevel?: number;
  }): Promise<{
    taskType: string;
    amount: number;
    pricingSnapshot?: Prisma.InputJsonValue;
    refundPolicySnapshot?: Prisma.InputJsonValue;
  }> {
    const estimate = await this.pointsService.estimateCost({
      taskType: input.taskType,
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      seconds: input.seconds,
      resolution: input.resolution,
      referenceImages: input.referenceImages,
      membershipLevel: input.membershipLevel,
    });
    return {
      taskType: estimate.taskType,
      amount: estimate.estimatedCost,
      pricingSnapshot: this.toJson(estimate.pricingSnapshot),
      refundPolicySnapshot: this.toJson(estimate.refundPolicy),
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
