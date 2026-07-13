import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ModelType, ModelVisibility, Prisma } from '../../platform/prisma/generated';
import { invalidateModelCache } from '../llm/model.factory';
import { ModelConfigRepository } from './model-config.repository';
import { MembershipService } from '../../billing/membership/membership.service';
import {
  validateParamsSchema,
  validatePricingSchema,
  type ParamsSchema,
  type PricingSchema,
  type SchemaViolation,
} from '@autix/domain/pricing';
import { validateDescription, type LocalizedText } from '@autix/domain/model';

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
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
  description?: LocalizedText;
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
  paramsSchema?: ParamsSchema;
  pricingSchema?: PricingSchema;
  description?: LocalizedText;
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

/**
 * 管理员路径的脱敏：只摘掉 apiKey 列。
 *
 * 后台需要看到 baseUrl / 内部 metadata 等配置字段才能配模型，所以它**不用**下面
 * 那个面向用户的白名单 DTO。两条路径的口径不同，是有意为之。
 */
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

/** 面向客户端的 metadata 白名单。**未列出的字段一律不返回**——包括将来新增的
 *  未知字段。这是白名单相对黑名单的全部意义：不需要有人记得去补 strip。 */
const CLIENT_METADATA_FIELDS = [
  'modelFamily',
  'protocolKey',
  'operations',
  'limits',
] as const;

/** 面向客户端的模型字段白名单。apiKey 列、baseUrl 列、以及任何内部字段都不在其中。 */
const CLIENT_MODEL_FIELDS = [
  'id',
  'name',
  'model',
  'provider',
  'type',
  'priority',
  'isDefault',
  'visibility',
  'capabilities',
  'paramsSchema',
  'pricingSchema',
  'schemaVersion',
  'description',
  'allowedMembershipLevels',
] as const;

function pick(source: object, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = (source as Record<string, unknown>)[key];
  }
  return out;
}

/**
 * 把一条 model_configs 记录投影成面向客户端的形状。
 *
 * ⚠ 安全底线（spec 口径 6）：API 密钥永不对任何用户暴露。这里用**白名单**而非
 * 黑名单——历史上的 stripMetadataCredentials 只剥 metadata.apiKey、漏了
 * metadata.baseUrl，而面向登录用户的 findAvailableModels 干脆一次都没调它。
 * 白名单让这两类错误都不可能再发生。
 *
 * 投影只在 **HTTP 边界（controller）** 上做，不在 service 方法里做：
 * findAvailableModels / findDefaultByTypeForUser 同时被 image-generation-flow、
 * video、orchestrator 等内部服务调用，它们**需要**完整记录里的 apiKey / baseUrl
 * 才能调上游。在 service 里脱敏会直接打断生成链路。
 */
export function toClientModelConfig(record: object): Record<string, unknown> {
  const base = pick(record, CLIENT_MODEL_FIELDS);
  const rawMeta = (record as { metadata?: unknown }).metadata;
  base.metadata =
    rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
      ? pick(rawMeta as object, CLIENT_METADATA_FIELDS)
      : {};
  return base;
}

@Injectable()
export class ModelConfigService {
  constructor(
    private readonly modelConfigRepository: ModelConfigRepository,
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

  async findSystemModels() {
    const models = await this.modelConfigRepository.findSystemModels();
    return models.map(stripModelConfigCredentials);
  }

  async findAvailableModels(userId: string) {
    const userLevelId = await this.membershipService.resolveActiveMembershipLevelId(userId);
    const publicModels = await this.modelConfigRepository.findAvailablePublicModels();
    return publicModels.filter((model) => this.canUseSystemModel(model, userLevelId));
  }

  async findAvailablePublicModels() {
    const publicModels = await this.modelConfigRepository.findAvailablePublicModels();
    return publicModels.map(stripModelConfigCredentials);
  }

  async findAvailableGeneralModels(userId: string) {
    return this.findAvailableModels(userId);
  }

  async findDefaultByTypeForUser(type: ModelType, userId: string) {
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
    if (config.visibility !== ModelVisibility.public) {
      throw new ForbiddenException({
        code: 'MODEL_NOT_AVAILABLE',
        message: '该模型不可用',
      });
    }
    if (userId) {
      await this.assertUserCanUseModel(userId, config);
    }
    return config;
  }

  async createSystemModel(dto: CreateModelConfigDto, adminUserId: string) {
    const type = dto.type ?? ModelType.general;

    // paramsSchema/pricingSchema are required on create (see CreateModelConfigDto),
    // so both are already-typed values here — no Prisma.JsonValue to narrow, just
    // runtime-validate the untrusted HTTP body against the domain rules.
    this.assertValidPricingConfig(dto.paramsSchema, dto.pricingSchema);
    if (dto.description !== undefined) {
      this.assertValidDescription(dto.description);
    }

    if (dto.isDefault) {
      await this.modelConfigRepository.clearPublicDefaults(type);
    }

    const data: Prisma.model_configsUncheckedCreateInput = {
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
      paramsSchema: dto.paramsSchema as unknown as Prisma.InputJsonValue,
      pricingSchema: dto.pricingSchema as unknown as Prisma.InputJsonValue,
    };
    // Deliberately no `dto.description ?? {}` fallback: omitting description on
    // create should leave the column at the Prisma-level default ("{}"), not force
    // every caller through description validation just because the DTO happened to
    // default the field for them.
    if (dto.description !== undefined) {
      data.description = dto.description as unknown as Prisma.InputJsonValue;
    }

    return this.modelConfigRepository.createWithAllowedMembershipLevels(
      data,
      this.normalizeAllowedMembershipLevelIds(dto.allowedMembershipLevelIds),
    );
  }

  async updateSystemModel(id: string, dto: UpdateModelConfigDto) {
    const existing = await this.modelConfigRepository.findPublicModel(id);
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }

    // Only validate what is actually being written. `paramsSchema`/`pricingSchema`
    // are legitimately NULL on models nobody has priced yet; an update that never
    // touches either field (e.g. renaming a model, or fixing its description) must
    // not be rejected just because those columns happen to be empty right now.
    if (dto.paramsSchema !== undefined || dto.pricingSchema !== undefined) {
      this.assertValidPricingConfigUpdate(dto, existing);
    }
    if (dto.description !== undefined) {
      this.assertValidDescription(dto.description);
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

  async deleteSystemModel(id: string) {
    const existing = await this.modelConfigRepository.findPublicModel(id);
    if (!existing) {
      throw new NotFoundException('模型配置不存在');
    }
    invalidateModelCache(id);
    return this.modelConfigRepository.delete(id);
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
    if (dto.paramsSchema !== undefined) {
      data.paramsSchema = dto.paramsSchema as unknown as Prisma.InputJsonValue;
    }
    if (dto.pricingSchema !== undefined) {
      data.pricingSchema = dto.pricingSchema as unknown as Prisma.InputJsonValue;
    }
    if (dto.description !== undefined) {
      data.description = dto.description as unknown as Prisma.InputJsonValue;
    }

    return data;
  }

  /**
   * Validates an already-typed create payload. Unlike the update path, create
   * requires both schemas up front, so there is nothing to narrow from
   * `Prisma.JsonValue` here — `dto.paramsSchema`/`dto.pricingSchema` are already
   * `ParamsSchema`/`PricingSchema` at the type level; the validators exist
   * precisely to check that an untrusted HTTP body actually has that shape at
   * runtime.
   */
  private assertValidPricingConfig(paramsSchema: ParamsSchema, pricingSchema: PricingSchema) {
    const violations: SchemaViolation[] = [
      ...validatePricingSchema(pricingSchema),
      ...validateParamsSchema(paramsSchema, pricingSchema),
    ];
    if (violations.length > 0) {
      throw new BadRequestException({ message: 'schema 校验失败', violations });
    }
  }

  private assertValidDescription(description: LocalizedText) {
    const badLocales = validateDescription(description);
    if (badLocales.length > 0) {
      throw new BadRequestException({
        message: `description 含不支持的 locale: ${badLocales.join(', ')}`,
        violations: badLocales,
      });
    }
  }

  /**
   * Update path: only the field(s) actually present in `dto` get validated.
   * The counterpart schema (params vs pricing) is read from `existing` purely to
   * run the cross-schema reference check — e.g. editing pricingSchema alone must
   * still catch a term that now references a param absent from the model's
   * already-saved paramsSchema. If that counterpart is still NULL (not configured
   * yet), the cross check is skipped rather than rejected: a partially-configured
   * model is a valid, in-progress state, not an error.
   *
   * `existing.paramsSchema`/`existing.pricingSchema` are `Prisma.JsonValue` (raw DB
   * JSON) — narrowed via the private `narrow*` helpers below, which cast only
   * immediately before a runtime validation that throws, never letting the
   * unvalidated cast result escape.
   */
  private assertValidPricingConfigUpdate(
    dto: { paramsSchema?: ParamsSchema; pricingSchema?: PricingSchema },
    existing: { paramsSchema: Prisma.JsonValue | null; pricingSchema: Prisma.JsonValue | null },
  ) {
    const violations: SchemaViolation[] = [];

    if (dto.pricingSchema !== undefined) {
      violations.push(...validatePricingSchema(dto.pricingSchema));
    }

    const effectivePricingSchema: PricingSchema | null =
      dto.pricingSchema !== undefined
        ? dto.pricingSchema
        : existing.pricingSchema === null
          ? null
          : this.narrowPricingSchema(existing.pricingSchema, '已保存的 pricingSchema');

    if (dto.paramsSchema !== undefined) {
      violations.push(
        ...validateParamsSchema(dto.paramsSchema, effectivePricingSchema ?? undefined),
      );
    } else if (dto.pricingSchema !== undefined && existing.paramsSchema !== null) {
      // pricingSchema changed but paramsSchema didn't: still must re-run the
      // cross-schema check against the saved paramsSchema, otherwise a new term
      // referencing a nonexistent param would silently no-op forever.
      const existingParamsSchema = this.narrowParamsSchema(
        existing.paramsSchema,
        '已保存的 paramsSchema',
      );
      violations.push(...validateParamsSchema(existingParamsSchema, effectivePricingSchema ?? undefined));
    }

    if (violations.length > 0) {
      throw new BadRequestException({ message: 'schema 校验失败', violations });
    }
  }

  private narrowPricingSchema(value: Prisma.JsonValue, subject: string): PricingSchema {
    const candidate = value as unknown as PricingSchema;
    const violations = validatePricingSchema(candidate);
    if (violations.length > 0) {
      throw new BadRequestException({ message: `${subject} 结构无效`, violations });
    }
    return candidate;
  }

  private narrowParamsSchema(value: Prisma.JsonValue, subject: string): ParamsSchema {
    const candidate = value as unknown as ParamsSchema;
    const violations = validateParamsSchema(candidate);
    if (violations.length > 0) {
      throw new BadRequestException({ message: `${subject} 结构无效`, violations });
    }
    return candidate;
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
