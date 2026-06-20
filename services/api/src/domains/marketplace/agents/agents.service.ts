import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  AgentKind,
  type Prisma,
} from '../../platform/prisma/generated';
import { BaseResourceService } from '../../platform/common/base-resource.service';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { RuntimeDetectorService } from '../../platform/common/runtime-detector.service';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';

export interface CreateAgentDto {
  title: string;
  description?: string;
  category: string;
  kind?: AgentKind;
  systemPrompt: string;
  toolBindings: { mcps?: string[]; skills?: string[] };
  defaultModel?: string;
  variables?: unknown[];
  coverImage?: string;
  exampleMedia?: string[];
  tags?: string[];
  pointsCost?: number;
  runtimeRequirement?: RuntimeReq;
}

export type UpdateAgentDto = Partial<CreateAgentDto>;

@Injectable()
export class AgentsService extends BaseResourceService {
  constructor(
    resourceInteractions: ResourceInteractionRepository,
    private readonly repository: MarketplaceResourceCrudRepository,
    private readonly detector: RuntimeDetectorService,
  ) {
    super(resourceInteractions);
  }

  protected get delegate() {
    return this.repository.delegateFor(ResourceType.AGENT);
  }

  protected get resourceType(): ResourceType {
    return ResourceType.AGENT;
  }

  async create(authorId: string, dto: CreateAgentDto) {
    const detection = await this.detector.detectAgent({
      toolBindings: dto.toolBindings,
      systemPrompt: dto.systemPrompt,
    });

    const runtimeRequirement =
      dto.runtimeRequirement ?? (detection.level as RuntimeReq);
    const runtimeDetectedBy = dto.runtimeRequirement
      ? DetectionSrc.AUTHOR
      : DetectionSrc.AUTO;

    return this.repository.createAgent({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      kind: dto.kind ?? AgentKind.chat,
      systemPrompt: dto.systemPrompt,
      toolBindings: this.toJson(dto.toolBindings),
      defaultModel: dto.defaultModel,
      variables: this.toJson(dto.variables ?? []),
      coverImage: dto.coverImage,
      exampleMedia: dto.exampleMedia ?? [],
      tags: dto.tags ?? [],
      pointsCost: dto.pointsCost ?? 0,
      runtimeRequirement,
      runtimeDetectedBy,
      runtimeReason: detection.reason,
      authorId,
      status: TemplateStatus.PENDING,
    });
  }

  async update(id: string, userId: string, dto: UpdateAgentDto) {
    const agent = (await this.findById(id)) as {
      authorId: string;
      toolBindings: { mcps?: string[]; skills?: string[] };
      systemPrompt: string;
      runtimeDetectedBy: DetectionSrc;
    };
    if (agent.authorId !== userId)
      throw new ForbiddenException('无权修改此 Agent');

    const data: Prisma.agentsUncheckedUpdateInput = {
      ...dto,
      toolBindings: dto.toolBindings ? this.toJson(dto.toolBindings) : undefined,
      variables: dto.variables ? this.toJson(dto.variables) : undefined,
      status: TemplateStatus.PENDING,
    };

    if (
      dto.toolBindings !== undefined &&
      agent.runtimeDetectedBy === DetectionSrc.AUTO
    ) {
      const detection = await this.detector.detectAgent({
        toolBindings: dto.toolBindings,
        systemPrompt: dto.systemPrompt ?? agent.systemPrompt,
      });
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

    return this.repository.updateAgent(id, data);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
