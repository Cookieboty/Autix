import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  AgentKind,
  type Prisma,
} from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { BaseResourceService } from '../common/base-resource.service';
import { RuntimeDetectorService } from '../common/runtime-detector.service';

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
    prisma: PrismaService,
    private readonly detector: RuntimeDetectorService,
  ) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.agents as unknown as {
      findMany: (args?: unknown) => Promise<unknown[]>;
      findUnique: (args: { where: { id: string } }) => Promise<unknown>;
      create: (args: { data: unknown }) => Promise<unknown>;
      update: (args: {
        where: { id: string };
        data: unknown;
      }) => Promise<unknown>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
      count: (args?: unknown) => Promise<number>;
    };
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

    return this.prisma.agents.create({
      data: {
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
      },
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

    return this.prisma.agents.update({ where: { id }, data });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
