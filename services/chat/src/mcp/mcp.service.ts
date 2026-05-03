import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  TemplateStatus,
  ResourceType,
  RuntimeReq,
  DetectionSrc,
  McpTransport,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BaseResourceService } from '../common/base-resource.service';
import { RuntimeDetectorService } from '../common/runtime-detector.service';
import { normalizeMcpConfig } from '../common/mcp-config.parser';

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
    prisma: PrismaService,
    private readonly detector: RuntimeDetectorService,
  ) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.mcp_servers as unknown as {
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

    return this.prisma.mcp_servers.create({
      data: {
        title: dto.title || normalized?.serverName || dto.serverName,
        description: dto.description,
        category: dto.category,
        rawConfig: (normalized?.rawConfig as object | undefined) ?? (dto.rawConfig as object | undefined),
        configFormat: dto.configFormat ?? 'mcp_json',
        serverName: normalized?.serverName ?? dto.serverName,
        transport,
        command,
        args,
        envSchema: (envSchema as object | undefined) ?? undefined,
        headersSchema:
          (normalized?.headersSchema as object | undefined) ??
          (dto.headersSchema as object | undefined) ??
          undefined,
        authSchema:
          (normalized?.authSchema as object | undefined) ??
          (dto.authSchema as object | undefined) ??
          undefined,
        tools: (normalized?.tools as object | undefined) ?? (dto.tools as object | undefined),
        capabilities:
          (normalized?.capabilities as object | undefined) ??
          (dto.capabilities as object | undefined),
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
      },
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
    if (mcp.authorId !== userId)
      throw new ForbiddenException('无权修改此 MCP 服务器');

    const normalized = dto.rawConfig
      ? normalizeMcpConfig(dto.rawConfig, dto.serverName ?? mcp.serverName)
      : undefined;
    const data: Record<string, unknown> = {
      ...dto,
      rawConfig: normalized?.rawConfig ?? dto.rawConfig,
      serverName: normalized?.serverName ?? dto.serverName,
      transport: normalized?.transport ?? dto.transport,
      command: normalized?.command ?? dto.command,
      args: normalized?.args ?? dto.args,
      url: normalized?.url ?? dto.url,
      envSchema: normalized?.envSchema ?? dto.envSchema,
      headersSchema: normalized?.headersSchema ?? dto.headersSchema,
      authSchema: normalized?.authSchema ?? dto.authSchema,
      tools: normalized?.tools ?? dto.tools,
      capabilities: normalized?.capabilities ?? dto.capabilities,
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

    return this.prisma.mcp_servers.update({ where: { id }, data });
  }
}
