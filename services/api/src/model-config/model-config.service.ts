import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelType, ModelVisibility, Prisma } from '../prisma/generated';
import { invalidateModelCache } from '../llm/model.factory';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface CreateModelConfigDto {
  name: string;
  provider?: string;
  model: string;
  type?: ModelType;
  priority?: number;
  baseUrl?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  visibility?: ModelVisibility;
  capabilities?: string[];
}

export interface UpdateModelConfigDto {
  name?: string;
  provider?: string;
  model?: string;
  type?: ModelType;
  priority?: number;
  baseUrl?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  visibility?: ModelVisibility;
  capabilities?: string[];
}

type ModelConfigUpdateData = Prisma.model_configsUncheckedUpdateInput;
type ModelSelectResult = Prisma.model_configsGetPayload<{
  select: typeof ModelConfigService.prototype.modelSelectFields;
}>;

@Injectable()
export class ModelConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  private maskApiKey<T extends { apiKey?: string | null; createdBy?: string | null }>(
    record: T,
    userId: string,
  ): T | Omit<T, 'apiKey'> {
    if (record.createdBy !== userId) {
      const { apiKey: _apiKey, ...rest } = record;
      return rest;
    }
    return record;
  }

  async findAllForUser(userId: string) {
    const records = await this.prisma.model_configs.findMany({
      where: {
        createdBy: userId,
        visibility: ModelVisibility.private,
      },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
    return records.map((r) => this.maskApiKey(r, userId));
  }

  async findSystemModels() {
    return this.prisma.model_configs.findMany({
      where: { visibility: ModelVisibility.public },
      orderBy: [{ type: 'asc' }, { priority: 'desc' }],
    });
  }

  async findOneForUser(id: string, userId: string) {
    const config = await this.prisma.model_configs.findFirst({
      where: { id, createdBy: userId, visibility: ModelVisibility.private },
    });
    if (!config) {
      throw new NotFoundException('模型配置不存在');
    }
    return config;
  }

  readonly modelSelectFields = {
    id: true,
    name: true,
    model: true,
    provider: true,
    type: true,
    priority: true,
    isDefault: true,
    visibility: true,
    capabilities: true,
    metadata: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async findAvailableModels(userId: string) {
    const modelConfigEnabled = await this.systemSettings.getBoolean('features.modelConfigEnabled');

    const queries: Promise<ModelSelectResult[]>[] = [
      this.prisma.model_configs.findMany({
        where: { isActive: true, visibility: ModelVisibility.public },
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
        select: this.modelSelectFields,
      }),
    ];

    // 仅在模型配置功能开启时才返回用户的私人模型
    if (modelConfigEnabled) {
      queries.push(
        this.prisma.model_configs.findMany({
          where: { isActive: true, createdBy: userId, visibility: ModelVisibility.private },
          orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { priority: 'desc' }],
          select: this.modelSelectFields,
        }),
      );
    }

    const results = await Promise.all(queries);
    return results.flat();
  }

  async findAvailableGeneralModels(userId: string) {
    return this.findAvailableModels(userId);
  }

  async findDefaultByTypeForUser(type: ModelType, userId: string) {
    const modelConfigEnabled = await this.systemSettings.getBoolean('features.modelConfigEnabled');

    // 仅在模型配置功能开启时才优先使用用户的私人默认模型
    if (modelConfigEnabled) {
      const privateDefault = await this.prisma.model_configs.findFirst({
        where: {
          type,
          isActive: true,
          isDefault: true,
          createdBy: userId,
          visibility: ModelVisibility.private,
        },
      });
      if (privateDefault) return this.maskApiKey(privateDefault, userId);
    }

    const publicDefault = await this.prisma.model_configs.findFirst({
      where: { type, isActive: true, isDefault: true, visibility: ModelVisibility.public },
    });
    if (publicDefault) return this.maskApiKey(publicDefault, userId);

    return null;
  }

  /**
   * 内部使用：获取某类型的默认模型（不区分用户），供 orchestrator / llm 等服务调用。
   */
  async findDefaultByType(type: ModelType) {
    return this.prisma.model_configs.findFirst({
      where: { type, isActive: true, isDefault: true, visibility: ModelVisibility.public },
    });
  }

  /**
   * 供 Orchestrator 内部使用，返回完整记录（含 apiKey），不通过 HTTP 暴露。
   */
  async getConfigForOrchestrator(id: string) {
    const config = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException(`模型配置不存在: ${id}`);
    }
    return config;
  }

  async create(dto: CreateModelConfigDto, userId: string) {
    const visibility = ModelVisibility.private;

    if (dto.isDefault) {
      await this.prisma.model_configs.updateMany({
        where: {
          type: dto.type ?? ModelType.general,
          createdBy: userId,
          visibility: ModelVisibility.private,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.model_configs.create({
      data: {
        name: dto.name,
        provider: dto.provider ?? 'openai',
        model: dto.model,
        type: dto.type ?? ModelType.general,
        priority: dto.priority ?? 0,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        metadata: this.toJsonInput(dto.metadata),
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        visibility,
        createdBy: userId,
        capabilities: dto.capabilities ?? ['text'],
      },
    });
  }

  async createSystemModel(dto: CreateModelConfigDto, adminUserId: string) {
    const type = dto.type ?? ModelType.general;

    if (dto.isDefault) {
      await this.prisma.model_configs.updateMany({
        where: {
          type,
          visibility: ModelVisibility.public,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.model_configs.create({
      data: {
        name: dto.name,
        provider: dto.provider ?? 'openai',
        model: dto.model,
        type,
        priority: dto.priority ?? 0,
        baseUrl: dto.baseUrl,
        apiKey: dto.apiKey,
        metadata: this.toJsonInput(dto.metadata),
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        visibility: ModelVisibility.public,
        createdBy: adminUserId,
        capabilities: dto.capabilities ?? ['text'],
      },
    });
  }

  async update(id: string, dto: UpdateModelConfigDto, userId: string) {
    const existing = await this.prisma.model_configs.findFirst({
      where: { id, createdBy: userId, visibility: ModelVisibility.private },
    });
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }

    if (dto.isDefault) {
      const effectiveType = dto.type ?? existing.type;
      await this.prisma.model_configs.updateMany({
        where: {
          type: effectiveType,
          createdBy: userId,
          visibility: ModelVisibility.private,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    invalidateModelCache(id);

    const data = this.buildUpdateData(dto);

    return this.prisma.model_configs.update({ where: { id }, data });
  }

  async updateSystemModel(id: string, dto: UpdateModelConfigDto) {
    const existing = await this.prisma.model_configs.findFirst({
      where: { id, visibility: ModelVisibility.public },
    });
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }

    if (dto.isDefault) {
      const effectiveType = dto.type ?? existing.type;
      await this.prisma.model_configs.updateMany({
        where: {
          type: effectiveType,
          visibility: ModelVisibility.public,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    invalidateModelCache(id);

    const data = this.buildUpdateData(dto);
    data.visibility = ModelVisibility.public;

    return this.prisma.model_configs.update({ where: { id }, data });
  }

  async deleteForUser(id: string, userId: string) {
    const existing = await this.prisma.model_configs.findFirst({
      where: { id, createdBy: userId, visibility: ModelVisibility.private },
    });
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }
    invalidateModelCache(id);
    return this.prisma.model_configs.delete({ where: { id } });
  }

  async deleteSystemModel(id: string) {
    const existing = await this.prisma.model_configs.findFirst({
      where: { id, visibility: ModelVisibility.public },
    });
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }
    invalidateModelCache(id);
    return this.prisma.model_configs.delete({ where: { id } });
  }

  // kept for internal/orchestrator usage
  async findById(id: string) {
    const config = await this.prisma.model_configs.findUnique({ where: { id } });
    if (!config) throw new NotFoundException(`模型配置不存在: ${id}`);
    return config;
  }

  private buildUpdateData(dto: UpdateModelConfigDto): ModelConfigUpdateData {
    const data: ModelConfigUpdateData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl;
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey;
    if (dto.metadata !== undefined) data.metadata = this.toJsonInput(dto.metadata);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.capabilities !== undefined) data.capabilities = dto.capabilities;

    return data;
  }

  private toJsonInput(value: Record<string, unknown> | undefined) {
    return value as Prisma.InputJsonValue | undefined;
  }
}
