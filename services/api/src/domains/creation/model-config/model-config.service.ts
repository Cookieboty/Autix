import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ModelType, ModelVisibility, Prisma } from '../../platform/prisma/generated';
import { invalidateModelCache } from '../llm/model.factory';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { ModelConfigRepository } from './model-config.repository';
import { MembershipService } from '../../billing/membership/membership.service';

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
  allowedMembershipLevelIds?: string[];
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
  allowedMembershipLevelIds?: string[];
}

type ModelConfigUpdateData = Prisma.model_configsUncheckedUpdateInput;
type ModelConfigAccessLike = {
  visibility?: ModelVisibility | string | null;
  allowedMembershipLevels?: Array<{
    levelId?: string | null;
    level?: { id?: string | null } | null;
  }> | null;
};

type ModelConfigResponseWithMetadata = {
  apiKey?: string | null;
  metadata?: Prisma.JsonValue | null;
};

function stripModelConfigCredentials<T extends ModelConfigResponseWithMetadata>(record: T) {
  const { apiKey: _apiKey, ...rest } = record;
  return {
    ...rest,
    metadata: stripMetadataCredentials(record.metadata),
  };
}

function stripMetadataCredentials(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { apiKey: _apiKey, ...rest } = value as Record<string, unknown>;
  return rest as Prisma.JsonObject;
}

@Injectable()
export class ModelConfigService {
  constructor(
    private readonly modelConfigRepository: ModelConfigRepository,
    private readonly systemSettings: SystemSettingsService,
    private readonly membershipService: MembershipService,
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
    const records = await this.modelConfigRepository.findPrivateModelsForUser(userId);
    return records.map((r) => this.maskApiKey(r, userId));
  }

  async findSystemModels() {
    const models = await this.modelConfigRepository.findSystemModels();
    return models.map(stripModelConfigCredentials);
  }

  async findOneForUser(id: string, userId: string) {
    const config = await this.modelConfigRepository.findPrivateModelForUser(id, userId);
    if (!config) {
      throw new NotFoundException('模型配置不存在');
    }
    return config;
  }

  async findAvailableModels(userId: string) {
    const modelConfigEnabled = await this.systemSettings.getBoolean('features.modelConfigEnabled');

    const userLevelId = await this.membershipService.resolveActiveMembershipLevelId(userId);
    const publicModels = await this.modelConfigRepository.findAvailablePublicModels();
    const visiblePublicModels = publicModels.filter((model) =>
      this.canUseSystemModel(model, userLevelId),
    );

    // 仅在模型配置功能开启时才返回用户的私人模型
    if (modelConfigEnabled) {
      const privateModels = await this.modelConfigRepository.findAvailablePrivateModels(userId);
      return [...visiblePublicModels, ...privateModels];
    }

    return visiblePublicModels;
  }

  async findAvailableGeneralModels(userId: string) {
    return this.findAvailableModels(userId);
  }

  async findDefaultByTypeForUser(type: ModelType, userId: string) {
    const modelConfigEnabled = await this.systemSettings.getBoolean('features.modelConfigEnabled');

    // 仅在模型配置功能开启时才优先使用用户的私人默认模型
    if (modelConfigEnabled) {
      const privateDefault = await this.modelConfigRepository.findPrivateDefaultByType(
        type,
        userId,
      );
      if (privateDefault) return this.maskApiKey(privateDefault, userId);
    }

    const publicDefault = await this.modelConfigRepository.findPublicDefaultByType(type);
    const userLevelId = await this.membershipService.resolveActiveMembershipLevelId(userId);
    if (publicDefault && this.canUseSystemModel(publicDefault, userLevelId)) {
      return this.maskApiKey(publicDefault, userId);
    }

    return null;
  }

  /**
   * 内部使用：获取某类型的默认模型（不区分用户），供 orchestrator / llm 等服务调用。
   */
  async findDefaultByType(type: ModelType) {
    return this.modelConfigRepository.findPublicDefaultByType(type);
  }

  /**
   * 供 Orchestrator 内部使用，返回完整记录（含 apiKey），不通过 HTTP 暴露。
   */
  async getConfigForOrchestrator(id: string, userId?: string) {
    const config = await this.modelConfigRepository.findById(id);
    if (!config) {
      throw new NotFoundException(`模型配置不存在: ${id}`);
    }
    if (userId) {
      await this.assertUserCanUseModel(userId, config);
    }
    return config;
  }

  async create(dto: CreateModelConfigDto, userId: string) {
    const visibility = ModelVisibility.private;

    if (dto.isDefault) {
      await this.modelConfigRepository.clearPrivateDefaults(
        dto.type ?? ModelType.general,
        userId,
      );
    }

    return this.modelConfigRepository.create({
      name: dto.name,
      provider: dto.provider ?? 'openai',
      model: dto.model,
      type: dto.type ?? ModelType.general,
      priority: dto.priority ?? 0,
      baseUrl: this.normalizeOptionalBaseUrl(dto.baseUrl),
      apiKey: this.normalizeOptionalSecret(dto.apiKey),
      metadata: this.toJsonInput(dto.metadata),
      isActive: dto.isActive ?? true,
      isDefault: dto.isDefault ?? false,
      visibility,
      createdBy: userId,
      capabilities: dto.capabilities ?? ['text'],
    });
  }

  async createSystemModel(dto: CreateModelConfigDto, adminUserId: string) {
    const type = dto.type ?? ModelType.general;

    if (dto.isDefault) {
      await this.modelConfigRepository.clearPublicDefaults(type);
    }

    return this.modelConfigRepository.createWithAllowedMembershipLevels(
      {
        name: dto.name,
        provider: dto.provider ?? 'openai',
        model: dto.model,
        type,
        priority: dto.priority ?? 0,
        baseUrl: this.normalizeOptionalBaseUrl(dto.baseUrl),
        apiKey: this.normalizeOptionalSecret(dto.apiKey),
        metadata: this.toJsonInput(dto.metadata),
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        visibility: ModelVisibility.public,
        createdBy: adminUserId,
        capabilities: dto.capabilities ?? ['text'],
      },
      this.normalizeAllowedMembershipLevelIds(dto.allowedMembershipLevelIds),
    );
  }

  async update(id: string, dto: UpdateModelConfigDto, userId: string) {
    const existing = await this.modelConfigRepository.findPrivateModelForUser(id, userId);
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }

    if (dto.isDefault) {
      const effectiveType = dto.type ?? existing.type;
      await this.modelConfigRepository.clearPrivateDefaults(effectiveType, userId, id);
    }

    invalidateModelCache(id);

    const data = this.buildUpdateData(dto);

    return this.modelConfigRepository.update(id, data);
  }

  async updateSystemModel(id: string, dto: UpdateModelConfigDto) {
    const existing = await this.modelConfigRepository.findPublicModel(id);
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }

    if (dto.isDefault) {
      const effectiveType = dto.type ?? existing.type;
      await this.modelConfigRepository.clearPublicDefaults(effectiveType, id);
    }

    invalidateModelCache(id);

    const data = this.buildUpdateData(dto);
    data.visibility = ModelVisibility.public;

    return this.modelConfigRepository.updateWithAllowedMembershipLevels(
      id,
      data,
      dto.allowedMembershipLevelIds === undefined
        ? undefined
        : this.normalizeAllowedMembershipLevelIds(dto.allowedMembershipLevelIds),
    );
  }

  async deleteForUser(id: string, userId: string) {
    const existing = await this.modelConfigRepository.findPrivateModelForUser(id, userId);
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }
    invalidateModelCache(id);
    return this.modelConfigRepository.delete(id);
  }

  async deleteSystemModel(id: string) {
    const existing = await this.modelConfigRepository.findPublicModel(id);
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }
    invalidateModelCache(id);
    return this.modelConfigRepository.delete(id);
  }

  // kept for internal/orchestrator usage
  async findById(id: string) {
    const config = await this.modelConfigRepository.findById(id);
    if (!config) throw new NotFoundException(`模型配置不存在: ${id}`);
    return config;
  }

  async assertUserCanUseModel(userId: string, model: ModelConfigAccessLike) {
    if (model.visibility !== ModelVisibility.public) return;

    const allowedLevelIds = this.getAllowedMembershipLevelIds(model);
    if (allowedLevelIds.length === 0) return;

    const userLevelId = await this.membershipService.resolveActiveMembershipLevelId(userId);
    if (userLevelId && allowedLevelIds.includes(userLevelId)) return;

    throw new ForbiddenException({
      code: 'MODEL_MEMBERSHIP_REQUIRED',
      message: '当前会员等级不可使用该模型，请升级会员或选择其他模型',
    });
  }

  private canUseSystemModel(model: ModelConfigAccessLike, userLevelId: string | null) {
    if (model.visibility !== ModelVisibility.public) return true;
    const allowedLevelIds = this.getAllowedMembershipLevelIds(model);
    if (allowedLevelIds.length === 0) return true;
    return Boolean(userLevelId && allowedLevelIds.includes(userLevelId));
  }

  private getAllowedMembershipLevelIds(model: ModelConfigAccessLike): string[] {
    return (model.allowedMembershipLevels ?? [])
      .map((item) => item.levelId ?? item.level?.id ?? null)
      .filter((levelId): levelId is string => typeof levelId === 'string' && levelId.length > 0);
  }

  private normalizeAllowedMembershipLevelIds(value: string[] | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item) => item.trim()),
      ),
    );
  }

  private buildUpdateData(dto: UpdateModelConfigDto): ModelConfigUpdateData {
    const data: ModelConfigUpdateData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.baseUrl !== undefined) {
      const baseUrl = this.normalizeOptionalBaseUrl(dto.baseUrl);
      if (baseUrl !== undefined) data.baseUrl = baseUrl;
    }
    if (dto.apiKey !== undefined) {
      const apiKey = this.normalizeOptionalSecret(dto.apiKey);
      if (apiKey !== undefined) data.apiKey = apiKey;
    }
    if (dto.metadata !== undefined) data.metadata = this.toJsonInput(dto.metadata);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.capabilities !== undefined) data.capabilities = dto.capabilities;

    return data;
  }

  private toJsonInput(value: Record<string, unknown> | undefined) {
    return value as Prisma.InputJsonValue | undefined;
  }

  private normalizeOptionalBaseUrl(value: string | undefined) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
    } catch {
      throw new BadRequestException('Base URL 必须是有效的 HTTP(S) URL');
    }

    return trimmed;
  }

  private normalizeOptionalSecret(value: string | undefined) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }
}
