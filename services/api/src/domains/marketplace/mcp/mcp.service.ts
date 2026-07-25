import { HttpStatus, Injectable } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  McpTransport,
  type Prisma,
} from '../../platform/prisma/generated';
import { BaseResourceService } from '../../platform/common/base-resource.service';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { ResourceInteractionRepository } from '../../platform/common/resource-interaction.repository';
import { RuntimeDetectorService } from '../../platform/common/runtime-detector.service';
import { normalizeMcpConfig } from '../../platform/common/mcp-config.parser';
import { ResourceMetricsService } from '../../platform/resource-metrics/resource-metrics.service';
import { MarketplaceResourceCrudRepository } from '../marketplace-resource-crud.repository';

export interface CreateMcpServerDto {
  title: string;
  description?: string;
  category: string;
  rawConfig?: unknown;
  configFormat?: string;
  serverName: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  envSchema?: Record<string, unknown>;
  headersSchema?: Record<string, unknown>;
  authSchema?: Record<string, unknown>;
  tools?: unknown;
  capabilities?: unknown;
  installNotes?: string;
  securityNotes?: string;
  url?: string;
  coverImage?: string;
  exampleMedia?: string[];
  tags?: string[];
  pointsCost?: number;
  runtimeRequirement?: RuntimeReq;
}

export type UpdateMcpServerDto = Partial<CreateMcpServerDto>;

@Injectable()
export class McpService extends BaseResourceService {
  constructor(
    resourceInteractions: ResourceInteractionRepository,
    private readonly repository: MarketplaceResourceCrudRepository,
    private readonly detector: RuntimeDetectorService,
    resourceMetrics: ResourceMetricsService,
  ) {
    super(resourceInteractions, resourceMetrics);
  }

  protected get delegate() {
    return this.repository.delegateFor(ResourceType.MCP);
  }

  protected get resourceType(): ResourceType {
    return ResourceType.MCP;
  }

  async create(authorId: string, dto: CreateMcpServerDto) {
    const normalized = dto.rawConfig
      ? normalizeMcpConfig(dto.rawConfig, dto.serverName)
      : undefined;
    const transport = normalized?.transport ?? dto.transport;
    const url = normalized?.url ?? dto.url;
    const command = normalized?.command ?? dto.command;
    const args = normalized?.args ?? dto.args ?? [];
    const envSchema = normalized?.envSchema ?? dto.envSchema;

    const detection = this.detector.detectMcp({
      transport,
      url,
      command,
      args,
      envSchema,
    });

    const runtimeRequirement =
      dto.runtimeRequirement ?? (detection.level as RuntimeReq);
    const runtimeDetectedBy = dto.runtimeRequirement
      ? DetectionSrc.AUTHOR
      : DetectionSrc.AUTO;

    return this.repository.createMcp({
      title: dto.title || normalized?.serverName || dto.serverName,
      description: dto.description,
      category: dto.category,
      rawConfig: this.optionalJson(normalized?.rawConfig ?? dto.rawConfig),
      configFormat: dto.configFormat ?? 'mcp_json',
      serverName: normalized?.serverName ?? dto.serverName,
      transport,
      command,
      args,
      envSchema: this.optionalJson(envSchema),
      headersSchema:
        this.optionalJson(normalized?.headersSchema ?? dto.headersSchema),
      authSchema:
        this.optionalJson(normalized?.authSchema ?? dto.authSchema),
      tools: this.optionalJson(normalized?.tools ?? dto.tools),
      capabilities:
        this.optionalJson(normalized?.capabilities ?? dto.capabilities),
      installNotes: dto.installNotes,
      securityNotes: dto.securityNotes,
      url,
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

  async update(id: string, userId: string, dto: UpdateMcpServerDto) {
    const mcp = (await this.findById(id)) as {
      authorId: string;
      serverName: string;
      transport: McpTransport;
      url: string | null;
      command: string | null;
      args: string[];
      envSchema: unknown;
      rawConfig: unknown;
      runtimeDetectedBy: DetectionSrc;
    };
    if (mcp.authorId !== userId) {
      throw new I18nHttpException(
        HttpStatus.FORBIDDEN,
        'mcp.update_forbidden',
      );
    }

    const normalized = dto.rawConfig
      ? normalizeMcpConfig(dto.rawConfig, dto.serverName ?? mcp.serverName)
      : undefined;
    const data: Prisma.mcp_serversUncheckedUpdateInput = {
      ...dto,
      rawConfig: this.optionalJson(normalized?.rawConfig ?? dto.rawConfig),
      serverName: normalized?.serverName ?? dto.serverName,
      transport: normalized?.transport ?? dto.transport,
      command: normalized?.command ?? dto.command,
      args: normalized?.args ?? dto.args,
      url: normalized?.url ?? dto.url,
      envSchema: this.optionalJson(normalized?.envSchema ?? dto.envSchema),
      headersSchema: this.optionalJson(normalized?.headersSchema ?? dto.headersSchema),
      authSchema: this.optionalJson(normalized?.authSchema ?? dto.authSchema),
      tools: this.optionalJson(normalized?.tools ?? dto.tools),
      capabilities: this.optionalJson(normalized?.capabilities ?? dto.capabilities),
      status: TemplateStatus.PENDING,
    };

    const transportChanged = dto.transport !== undefined || normalized !== undefined;
    const urlChanged = dto.url !== undefined;
    const envChanged = dto.envSchema !== undefined || normalized?.envSchema !== undefined;

    if (
      (transportChanged || urlChanged || envChanged) &&
      mcp.runtimeDetectedBy === DetectionSrc.AUTO
    ) {
      const detection = this.detector.detectMcp({
        transport: normalized?.transport ?? dto.transport ?? mcp.transport,
        url: normalized?.url ?? dto.url ?? mcp.url ?? undefined,
        command: normalized?.command ?? dto.command ?? mcp.command ?? undefined,
        args: normalized?.args ?? dto.args ?? mcp.args,
        envSchema: normalized?.envSchema ?? dto.envSchema ?? mcp.envSchema,
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

    return this.repository.updateMcp(id, data);
  }

  private optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : this.toJson(value);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
