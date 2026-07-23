import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  quoteTask,
  validateParamsSchema,
  validatePricingSchema,
  type Breakdown,
  type ParamsSchema,
  type PricingSchema,
} from '@autix/domain/pricing';
import { readProtocolKey, validateDescription, type LocalizedText } from '@autix/domain/model';
import { tryResolveAnyPreset } from '@autix/ai-adapters';
import { PricingConfigAdminRepository } from './pricing-config-admin.repository';
import type { Prisma } from '../../../platform/prisma/generated';

/** task_definitions.category → 协议媒体。chat / prompt 无协议概念 → null。 */
function mediaOfCategory(category: string | undefined | null): 'image' | 'video' | null {
  if (category === 'image') return 'image';
  if (category === 'video') return 'video';
  return null;
}

export interface DryRunInput {
  paramsSchema: unknown;
  pricingSchema: unknown;
  sampleParams: Record<string, unknown>;
  sampleUsage?: Record<string, unknown>;
}

export interface DryRunResult {
  total: number;
  breakdown: Breakdown[];
}

/**
 * Mirrors DiscountScope in services/api/src/domains/billing/points/pricing-discount.helpers.ts.
 * Not imported from there directly — this admin module is deliberately a Prisma-only leaf
 * (see pricing-config-admin.module.ts) with no dependency on the billing/points domain, so the
 * shape is duplicated at this narrow boundary rather than adding a cross-domain import.
 */
interface AdminDiscountScope {
  membershipLevelNumbers?: number[];
  taskTypes?: string[];
  modelConfigIds?: string[];
}

export interface CreateTaskDefinitionInput {
  taskType: string;
  name: string;
  category: string;
  fixedCostSchema?: unknown | null;
}

export interface UpdateTaskDefinitionInput {
  name?: string;
  category?: string;
  fixedCostSchema?: unknown | null;
  isActive?: boolean;
  sort?: number;
}

export interface CreateTaskModelBindingInput {
  taskType: string;
  modelConfigId: string;
  multiplier?: number;
  isDefault?: boolean;
}

export interface UpdateTaskModelBindingInput {
  multiplier?: number;
  isDefault?: boolean;
  isActive?: boolean;
  sort?: number;
}

export interface CreateDiscountInput {
  code: string;
  name: string;
  factor: number;
  scope: unknown;
  stackable?: boolean;
  priority?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface UpdateDiscountInput {
  name?: string;
  factor?: number;
  scope?: unknown;
  stackable?: boolean;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

/**
 * Admin-only surface for editing a model's paramsSchema/pricingSchema/description and
 * previewing a price before saving. Validation is the whole point here: an operator's typo
 * mis-prices or free-prices real generations, so every write path narrows its `unknown` input
 * through the same domain validators the real charge path trusts, and nothing unvalidated ever
 * reaches the repository or the pricing evaluator.
 */
@Injectable()
export class PricingConfigAdminService {
  constructor(private readonly repo: PricingConfigAdminRepository) { }

  async getModel(modelConfigId: string) {
    const model = await this.repo.findModelConfig(modelConfigId);
    if (!model) throw new NotFoundException(`Model configuration not found: ${modelConfigId}`);
    return model;
  }

  async updateModelSchemas(
    modelConfigId: string,
    input: { paramsSchema: unknown; pricingSchema: unknown },
  ) {
    const { paramsSchema, pricingSchema } = this.narrowSchemas(input.paramsSchema, input.pricingSchema);

    const updated = await this.repo.updateModelSchemas(modelConfigId, {
      paramsSchema: paramsSchema as unknown as Prisma.InputJsonValue,
      pricingSchema: pricingSchema as unknown as Prisma.InputJsonValue,
    });
    if (!updated) throw new NotFoundException(`Model configuration not found: ${modelConfigId}`);
    return updated;
  }

  async updateModelDescription(modelConfigId: string, description: unknown) {
    const candidate = this.narrowDescription(description);

    const updated = await this.repo.updateModelDescription(
      modelConfigId,
      candidate as unknown as Prisma.InputJsonValue,
    );
    if (!updated) throw new NotFoundException(`Model configuration not found: ${modelConfigId}`);
    return updated;
  }

  /**
   * Pure preview: never touches the repository, never creates a hold. Prices with `quoteTask`
   * — the same evaluator `TaskPricingEstimatorService` calls for a real charge — with
   * multiplier 1 / discountFactor 1 / no task-fixed schema, so an operator previews the model's
   * own schema math, not a reimplementation of it.
   */
  dryRun(input: DryRunInput): DryRunResult {
    const { pricingSchema } = this.narrowSchemas(input.paramsSchema, input.pricingSchema);

    const result = quoteTask({
      modelSchema: pricingSchema,
      multiplier: 1,
      discountFactor: 1,
      taskFixedSchema: null,
      params: input.sampleParams,
      usage: input.sampleUsage,
    });

    return { total: result.total, breakdown: result.breakdown };
  }

  /**
   * `rawParamsSchema`/`rawPricingSchema` are `unknown` — request bodies (already `IsObject`
   * shaped by the DTO, but structurally unrelated to `ParamsSchema`/`PricingSchema` as far as
   * TypeScript is concerned). The cast to the domain type is safe only because it never escapes
   * this function unvalidated: `validatePricingSchema`/`validateParamsSchema` re-check the
   * *runtime* shape (they tolerate arbitrary JSON, including null) and this throws before the
   * candidate is used for anything — persisted or priced. Mirrors
   * narrowPricingSchema/narrowParamsSchema in TaskPricingEstimatorService.
   */
  private narrowSchemas(
    rawParamsSchema: unknown,
    rawPricingSchema: unknown,
  ): { paramsSchema: ParamsSchema; pricingSchema: PricingSchema } {
    const pricingCandidate = rawPricingSchema as unknown as PricingSchema;
    const paramsCandidate = rawParamsSchema as unknown as ParamsSchema;

    const violations = [
      ...validatePricingSchema(pricingCandidate),
      ...validateParamsSchema(paramsCandidate, pricingCandidate),
    ];
    if (violations.length > 0) {
      throw new BadRequestException({ message: 'schema validation failed', violations });
    }

    return { paramsSchema: paramsCandidate, pricingSchema: pricingCandidate };
  }

  /** Same reasoning as narrowSchemas — the cast never escapes unvalidated. */
  private narrowDescription(raw: unknown): LocalizedText {
    const candidate = raw as unknown as LocalizedText;
    const badLocales = validateDescription(candidate);
    if (badLocales.length > 0) {
      throw new BadRequestException({
        message: `description contains unsupported locales: ${badLocales.join(', ')}`,
        violations: badLocales,
      });
    }
    return candidate;
  }

  // =======================================================================
  // task_definitions (Task 18)
  // =======================================================================

  async listTaskDefinitions() {
    return this.repo.listTaskDefinitions();
  }

  async createTaskDefinition(input: CreateTaskDefinitionInput) {
    const fixedCostSchema = this.narrowFixedCostSchema(input.fixedCostSchema ?? null);
    try {
      return await this.repo.createTaskDefinition({
        taskType: input.taskType,
        name: input.name,
        category: input.category,
        fixedCostSchema: fixedCostSchema as unknown as Prisma.InputJsonValue | null,
      });
    } catch (err) {
      throw this.translatePrismaError(err, { conflict: `Task type already exists: ${input.taskType}` });
    }
  }

  async updateTaskDefinition(taskType: string, input: UpdateTaskDefinitionInput) {
    const data: Partial<{
      name: string;
      category: string;
      fixedCostSchema: Prisma.InputJsonValue | null;
      isActive: boolean;
      sort: number;
    }> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.sort !== undefined) data.sort = input.sort;
    if (input.fixedCostSchema !== undefined) {
      data.fixedCostSchema = this.narrowFixedCostSchema(
        input.fixedCostSchema,
      ) as unknown as Prisma.InputJsonValue | null;
    }

    try {
      return await this.repo.updateTaskDefinition(taskType, data);
    } catch (err) {
      throw this.translatePrismaError(err, { notFound: `Task not found: ${taskType}` });
    }
  }

  /**
   * DELETE /admin/task-definitions/:taskType — a soft delete (isActive: false), not a hard
   * row delete. Deliberately does NOT block deactivating a task that still has active
   * task_model_bindings pointing at it: TaskPricingEstimatorService already checks
   * `task.isActive` on every estimate and throws a clean, distinct 400 ("任务已停用") before
   * it ever looks at bindings — the exact same controlled-4xx contract this module owes
   * everywhere else. Adding a second, admin-side "does this task have live bindings" guard
   * would duplicate that check, could race with a binding being created concurrently, and
   * would not prevent anything worse than the 400 the pricing engine already returns.
   * assertActiveTasksHaveDefaultBinding (services/api/scripts/seed-pricing.ts) enforces the
   * "every active task has exactly one active default binding" invariant at seed time — that
   * is a data-hygiene gate for what ships, not a live constraint this endpoint must re-police
   * on every admin edit.
   */
  async deleteTaskDefinition(taskType: string) {
    try {
      return await this.repo.deactivateTaskDefinition(taskType);
    } catch (err) {
      throw this.translatePrismaError(err, { notFound: `Task not found: ${taskType}` });
    }
  }

  /** fixedCostSchema 校验：task 的固定费是真实金额，与 model pricingSchema 走同一条 validate-and-throw 路径。 */
  private narrowFixedCostSchema(raw: unknown): PricingSchema | null {
    if (raw === null) return null;
    const candidate = raw as unknown as PricingSchema;
    const violations = validatePricingSchema(candidate);
    if (violations.length > 0) {
      throw new BadRequestException({ message: 'fixedCostSchema validation failed', violations });
    }
    return candidate;
  }

  // =======================================================================
  // task_model_bindings (Task 19)
  // =======================================================================

  async listTaskModelBindings(taskType?: string) {
    const rows = await this.repo.listTaskModelBindings(taskType);
    // 展平出 modelName / model，供后台绑定页显示可读名称（回退到 modelConfigId）
    return rows.map(({ modelConfig, ...binding }) => ({
      ...binding,
      modelName: modelConfig?.name ?? binding.modelConfigId,
      model: modelConfig?.model ?? '',
    }));
  }

  async createTaskModelBinding(input: CreateTaskModelBindingInput) {
    const multiplier = input.multiplier ?? 1;
    this.assertPositiveFiniteMultiplier(multiplier);
    await this.assertModelIsPriceable(input.modelConfigId);
    await this.assertBindingMediaMatches(input.taskType, input.modelConfigId);

    try {
      return await this.repo.createTaskModelBinding({
        taskType: input.taskType,
        modelConfigId: input.modelConfigId,
        multiplier,
        isDefault: input.isDefault ?? false,
      });
    } catch (err) {
      throw this.translatePrismaError(err, {
        conflict: `Binding already exists: task ${input.taskType} with model ${input.modelConfigId}`,
        badRequest: `Task or model not found: task ${input.taskType}, model ${input.modelConfigId}`,
      });
    }
  }

  async updateTaskModelBinding(taskType: string, modelConfigId: string, input: UpdateTaskModelBindingInput) {
    const data: Partial<{ multiplier: number; isDefault: boolean; isActive: boolean; sort: number }> = {};
    if (input.multiplier !== undefined) {
      this.assertPositiveFiniteMultiplier(input.multiplier);
      data.multiplier = input.multiplier;
    }
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.sort !== undefined) data.sort = input.sort;

    try {
      return await this.repo.updateTaskModelBinding(taskType, modelConfigId, data);
    } catch (err) {
      throw this.translatePrismaError(err, {
        notFound: `Binding not found: task ${taskType}, model ${modelConfigId}`,
      });
    }
  }

  async deleteTaskModelBinding(taskType: string, modelConfigId: string) {
    try {
      return await this.repo.deleteTaskModelBinding(taskType, modelConfigId);
    } catch (err) {
      throw this.translatePrismaError(err, {
        notFound: `Binding not found: task ${taskType}, model ${modelConfigId}`,
      });
    }
  }

  /** multiplier is Decimal(6,3): a zero or negative multiplier would price every call at 0 or negative. */
  private assertPositiveFiniteMultiplier(multiplier: number) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new BadRequestException(`multiplier must be a positive number: ${multiplier}`);
    }
  }

  /**
   * A binding authorises a model for a task (task_model_bindings presence is the
   * authorisation check in TaskPricingEstimatorService.resolveBinding) — authorising a model
   * whose pricingSchema is NULL would create a binding that can never actually be priced,
   * failing every real request with a 400 the admin could have caught at binding-creation
   * time instead.
   */
  private async assertModelIsPriceable(modelConfigId: string) {
    const model = await this.repo.findModelConfig(modelConfigId);
    if (!model) {
      throw new NotFoundException(`Model configuration not found: ${modelConfigId}`);
    }
    if (model.pricingSchema === null) {
      throw new BadRequestException(
        `Model has no pricingSchema configured and cannot be bound: ${modelConfigId}`,
      );
    }
  }

  /**
   * 绑定期的媒体一致性校验。
   *
   * 全局 registry 让 protocolKey 自描述媒体，解决了**模型保存期**的分派 —— 但管不到
   * 绑定期：一个 ark-video@v3 的模型可以被绑到 image_generation，保存时完全合法，
   * 直到运行时图片 flow 调 resolveImagePreset('ark-video@v3') 才 500。
   * 这是「配置期静默、运行期爆炸」的典型形态。
   *
   * **事实源是 DB 的 task_definitions.category，不是静态的 TASK_PRESETS**：后台可以
   * 动态创建任意 category 的任务类型（createTaskDefinition 接受任意 category），也能改
   * 现有任务的 category（updateTaskDefinition）。拿静态数组判媒体会漏掉自定义的
   * category:'video' 任务，也对 category 变更无感。
   */
  private async assertBindingMediaMatches(taskType: string, modelConfigId: string): Promise<void> {
    const definition = await this.repo.findTaskDefinition(taskType);
    const media = mediaOfCategory(definition?.category);
    // chat / prompt 等任务没有协议概念，跳过。
    if (!media) return;

    const model = await this.repo.findModelConfig(modelConfigId);
    const protocolKey = readProtocolKey(model?.metadata);
    if (!protocolKey) {
      throw new BadRequestException(
        `Task ${taskType} (${media}) requires the model to declare metadata.protocolKey`,
      );
    }
    const entry = tryResolveAnyPreset(protocolKey);
    if (!entry) {
      throw new BadRequestException(`Unknown protocolKey: ${protocolKey}`);
    }
    if (entry.media !== media) {
      throw new BadRequestException(
        `Media mismatch: task ${taskType} (${media}) cannot bind a model with ${entry.media} protocol (${protocolKey})`,
      );
    }
  }

  // =======================================================================
  // pricing_discounts (Task 20)
  // =======================================================================

  async listDiscounts() {
    return this.repo.listDiscounts();
  }

  async createDiscount(input: CreateDiscountInput) {
    this.assertPositiveFiniteFactor(input.factor);
    const scope = this.narrowDiscountScope(input.scope);
    const { effectiveFrom, effectiveTo } = this.narrowEffectiveRange(input.effectiveFrom, input.effectiveTo);

    try {
      return await this.repo.createDiscount({
        code: input.code,
        name: input.name,
        factor: input.factor,
        scope: scope as unknown as Prisma.InputJsonValue,
        stackable: input.stackable ?? false,
        priority: input.priority ?? 0,
        effectiveFrom: effectiveFrom ?? null,
        effectiveTo: effectiveTo ?? null,
      });
    } catch (err) {
      throw this.translatePrismaError(err, { conflict: `Discount code already exists: ${input.code}` });
    }
  }

  async updateDiscount(id: string, input: UpdateDiscountInput) {
    const data: Partial<{
      name: string;
      factor: number;
      scope: Prisma.InputJsonValue;
      stackable: boolean;
      priority: number;
      isActive: boolean;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
    }> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.factor !== undefined) {
      this.assertPositiveFiniteFactor(input.factor);
      data.factor = input.factor;
    }
    if (input.scope !== undefined) {
      data.scope = this.narrowDiscountScope(input.scope) as unknown as Prisma.InputJsonValue;
    }
    if (input.stackable !== undefined) data.stackable = input.stackable;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.effectiveFrom !== undefined || input.effectiveTo !== undefined) {
      const { effectiveFrom, effectiveTo } = this.narrowEffectiveRange(input.effectiveFrom, input.effectiveTo);
      if (input.effectiveFrom !== undefined) data.effectiveFrom = effectiveFrom ?? null;
      if (input.effectiveTo !== undefined) data.effectiveTo = effectiveTo ?? null;
    }

    try {
      return await this.repo.updateDiscount(id, data);
    } catch (err) {
      throw this.translatePrismaError(err, {
        conflict: `Discount code already exists`,
        notFound: `Discount not found: ${id}`,
      });
    }
  }

  async deleteDiscount(id: string) {
    try {
      return await this.repo.deleteDiscount(id);
    } catch (err) {
      throw this.translatePrismaError(err, { notFound: `Discount not found: ${id}` });
    }
  }

  /**
   * factor > 0 only. factor > 1 (a surcharge) is deliberately ALLOWED: nothing in
   * resolveDiscountFactor/discountApplies (pricing-discount.helpers.ts) assumes factor <= 1 —
   * stackable discounts multiply, non-stackable discounts pick the minimum factor among
   * matches — so a >1 "discount" is just a legitimate surcharge row (e.g. peak-time pricing
   * for a specific taskType/modelConfigId scope) and the arithmetic handles it correctly. Only
   * factor <= 0 is nonsensical: 0 makes the scoped calls free, negative makes them pay the
   * user.
   */
  private assertPositiveFiniteFactor(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new BadRequestException(`factor must be a positive number: ${factor}`);
    }
  }

  /**
   * `scope` is free-form JSON, but membershipLevelNumbers/taskTypes/modelConfigIds have a
   * specific runtime shape that discountApplies (pricing-discount.helpers.ts) reads without
   * further validation. membershipLevelNumbers in particular must be number[] — it's compared
   * against resolveActiveMembershipLevel()'s numeric level, NOT membership_levels' cuid id — a
   * caller passing string numbers (e.g. ['1']) would silently never match anything, and the
   * discount would appear configured but never apply. Unknown extra keys are left alone (UI
   * forward-compatibility); only the three known dimensions are shape-checked.
   */
  private narrowDiscountScope(raw: unknown): AdminDiscountScope {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('scope must be an object');
    }
    const candidate = raw as Record<string, unknown>;

    if (candidate.membershipLevelNumbers !== undefined && !this.isNumberArray(candidate.membershipLevelNumbers)) {
      throw new BadRequestException(
        'scope.membershipLevelNumbers must be number[] (membership level numbers, not cuid strings)',
      );
    }
    if (candidate.taskTypes !== undefined && !this.isStringArray(candidate.taskTypes)) {
      throw new BadRequestException('scope.taskTypes must be string[]');
    }
    if (candidate.modelConfigIds !== undefined && !this.isStringArray(candidate.modelConfigIds)) {
      throw new BadRequestException('scope.modelConfigIds must be string[]');
    }

    return candidate as AdminDiscountScope;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
  }

  private isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v));
  }

  /**
   * Validates internal consistency of the payload's own from/to pair only (both provided in
   * the same request). It does not read back the persisted counterpart when only one side is
   * being patched — doing so would need an extra repository round trip for a same-request
   * ordering check the brief scopes to "if both set". A discount whose from/to straddle across
   * two separate PATCHes into an inconsistent order is a known gap; see report.
   */
  private narrowEffectiveRange(
    fromRaw: string | null | undefined,
    toRaw: string | null | undefined,
  ): { effectiveFrom?: Date | null; effectiveTo?: Date | null } {
    const effectiveFrom = fromRaw === undefined ? undefined : fromRaw === null ? null : new Date(fromRaw);
    const effectiveTo = toRaw === undefined ? undefined : toRaw === null ? null : new Date(toRaw);

    if (effectiveFrom instanceof Date && effectiveTo instanceof Date && effectiveFrom >= effectiveTo) {
      throw new BadRequestException('effectiveFrom must be earlier than effectiveTo');
    }

    return { effectiveFrom, effectiveTo };
  }

  /**
   * Single point of Prisma error → controlled-4xx translation for the CRUD added in Task
   * 18/19/20, mirroring the not-found-as-null contract Task 17 already established
   * (updateModelSchemas/updateModelDescription) at the DB-constraint layer instead: P2002
   * (unique violation — duplicate taskType / composite binding key / discount code, or a
   * default-binding race the repository's transaction didn't already prevent) becomes 409;
   * P2025 (record to update/delete not found) becomes 404; P2003 (foreign key violation — e.g.
   * a binding referencing a taskType/modelConfigId that doesn't exist) becomes 400. Anything
   * else is rethrown as-is rather than swallowed.
   */
  private translatePrismaError(
    err: unknown,
    labels: { conflict?: string; notFound?: string; badRequest?: string } = {},
  ): never {
    const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
    if (code === 'P2002') {
      throw new ConflictException(labels.conflict ?? 'Record already exists');
    }
    if (code === 'P2025') {
      throw new NotFoundException(labels.notFound ?? 'Record not found');
    }
    if (code === 'P2003') {
      throw new BadRequestException(labels.badRequest ?? 'Referenced record does not exist');
    }
    throw err as Error;
  }
}
