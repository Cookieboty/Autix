import { BadRequestException, Injectable } from '@nestjs/common';
import {
  applyParamDefaults,
  quoteTask,
  validateParams,
  validatePricingSchema,
  validateParamsSchema,
  type Breakdown,
  type ParamsSchema,
  type PricingSchema,
  type PricingSnapshot,
} from '@autix/domain/pricing';
import { TaskPricingRepository } from '../repositories/task-pricing.repository';
import { resolveDiscountFactor, toDiscountRow } from '../pricing-discount.helpers';
import type { Prisma, task_model_bindings } from '../../../platform/prisma/generated';

export interface TaskEstimateInput {
  taskType: string;
  modelConfigId?: string;
  params: Record<string, unknown>;
  usage?: Record<string, unknown>;
  membershipLevel?: number;
}

export interface TaskEstimateResult {
  estimatedCost: number;
  taskType: string;
  modelConfigId: string;
  breakdown: Breakdown[];
  pricingSnapshot: PricingSnapshot;
}

/**
 * Orchestrates the new pricing engine: task_definitions -> task_model_bindings ->
 * model_configs -> quoteTask. This is the first place in phase 2 where real money
 * is computed, so every missing/invalid piece of configuration is a loud 400, never
 * a silently-computed 0 or NaN. There is no fallback to the old
 * ceil(pointCostWeight * basePerCall) formula — that engine is being deleted, not
 * mirrored here.
 */
/** 冻进 PricingSnapshot 的 role。缺省（未写 role）= 'both' → 保留，向后兼容存量 schema。 */
const PRICING_ROLES = new Set(['pricing', 'both', 'derived']);

/**
 * 把参数收缩成「真正参与计价的那一份」，用于冻进 `PricingSnapshot.params`。
 *
 * 两个**正交**的过滤，缺一不可：
 *
 * 1. **role**（墙 7）——只留 pricing / both / derived。`role: 'wire'` 的参数（size、
 *    seed、negativePrompt…）不参与计价。`applyParamDefaults` 会给所有带 `default` 的
 *    属性填值，不滤掉它们就会被冻进快照；而 `quote.ts` 的 `mergeParamsAndUsage` 有
 *    「params/usage key 冲突即 throw」的断言 —— 快照里塞不该有的 key 是在埋雷。
 *
 * 2. **valueSource**（spec §3.1.1.65）——剥掉 `usage` 参数。文本模型的
 *    inputTokens/outputTokens 只有结算时才知道真值，冻一个估算值（或 default 的 0）
 *    进去，会让每次结算都按 0 token 计价。这是真实发生过的线上 bug。
 *
 *    这也是一道独立于 `applyParamDefaults` 的防御（后者已经拒绝为这类属性**填**默认值）：
 *    它还覆盖「调用方显式传了一个 token 估算值来影响本次报价」的情况 —— 那个值参与了
 *    本次 quote，但不该活到快照里被结算时重新计价。
 *
 * ⚠ 两者是**叠加**不是**取代**：一个 role: 'both' 且 valueSource: 'usage' 的属性
 * 必须被剥掉。
 */
export function stripNonPricingParams(
  paramsSchema: ParamsSchema,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const stripped: Record<string, unknown> = { ...params };
  for (const [name, property] of Object.entries(paramsSchema.properties ?? {})) {
    const ui = property['x-ui'];
    const role = ui?.role ?? 'both';
    if (!PRICING_ROLES.has(role) || ui?.valueSource === 'usage') {
      delete stripped[name];
    }
  }
  return stripped;
}

@Injectable()
export class TaskPricingEstimatorService {
  constructor(private readonly repo: TaskPricingRepository) {}

  async estimateCost(input: TaskEstimateInput): Promise<TaskEstimateResult> {
    const task = await this.repo.findTaskDefinition(input.taskType);
    if (!task) {
      throw new BadRequestException(`任务未配置: ${input.taskType}`);
    }
    if (!task.isActive) {
      throw new BadRequestException(`任务已停用: ${input.taskType}`);
    }

    const binding = await this.resolveBinding(input.taskType, input.modelConfigId);
    const modelConfigId = binding.modelConfigId;

    const model = await this.repo.findModelPricingConfig(modelConfigId);
    if (!model) {
      throw new BadRequestException(`模型未找到: ${modelConfigId}`);
    }
    // NULL means "not configured". Falling back to {} / { terms: [] } here would make
    // evaluatePricing return total: 0 — silent free generation. Reject instead.
    if (model.pricingSchema === null) {
      throw new BadRequestException(`模型未配置计价规则(pricingSchema): ${modelConfigId}`);
    }
    if (model.paramsSchema === null) {
      throw new BadRequestException(`模型未配置参数规则(paramsSchema): ${modelConfigId}`);
    }

    const pricingSchema = this.narrowPricingSchema(
      model.pricingSchema,
      `模型计价规则结构无效: ${modelConfigId}`,
    );
    const paramsSchema = this.narrowParamsSchema(
      model.paramsSchema,
      pricingSchema,
      `模型参数规则结构无效: ${modelConfigId}`,
    );
    const taskFixedSchema =
      task.fixedCostSchema === null
        ? null
        : this.narrowPricingSchema(task.fixedCostSchema, `任务固定成本规则结构无效: ${input.taskType}`);

    // Callers legitimately submit partial params — canvas has no
    // quality/resolution picker, a template's params are author-fixed — and
    // validateParams is ajv in full strict mode, which never fills defaults
    // itself. Fill from the schema's own `default`s before validating, and use
    // the filled object for everything downstream (quoteTask + the snapshot),
    // not just validation, so settlement re-prices from the same params the
    // estimate was actually priced with.
    const params = applyParamDefaults(paramsSchema, input.params);

    const violations = validateParams(paramsSchema, params);
    if (violations.length > 0) {
      throw new BadRequestException({ message: '参数不合法', violations });
    }

    const membershipLevel = input.membershipLevel ?? 0;
    const now = new Date();
    const discountRows = (await this.repo.findActiveDiscounts(now)).map(toDiscountRow);
    const { factor: discountFactor, code: discountCode } = resolveDiscountFactor(
      discountRows,
      { membershipLevel, taskType: input.taskType, modelConfigId },
      now,
    );

    const multiplier = this.toMultiplier(binding);

    const result = quoteTask({
      modelSchema: pricingSchema,
      multiplier,
      discountFactor,
      taskFixedSchema,
      params,
      usage: input.usage,
    });

    // Value copy: point_holds.pricingSnapshot is read back at settlement time, so an
    // admin editing model_configs.pricingSchema after a hold is created must never
    // change what that in-flight task is charged.
    //
    // The frozen params exclude valueSource: 'usage' properties (spec §3.1.1.65):
    // a text model's inputTokens/outputTokens are only known at settlement, via
    // real usage — freezing an estimate-time value (or a default of 0) is the
    // direct cause of the under-charging bug this fix exists for. If a caller did
    // pass a token estimate in `params` above, it was already used by quoteTask
    // to compute `result` — it just does not survive into the frozen snapshot.
    const frozenParams = stripNonPricingParams(paramsSchema, params);

    const pricingSnapshot: PricingSnapshot = {
      schemaVersion: model.schemaVersion,
      modelConfigId,
      modelSchema: structuredClone(pricingSchema),
      taskFixedSchema: taskFixedSchema ? structuredClone(taskFixedSchema) : null,
      multiplier,
      discountFactor,
      discountCode,
      params: structuredClone(frozenParams),
    };

    return {
      estimatedCost: result.total,
      taskType: input.taskType,
      modelConfigId,
      breakdown: result.breakdown,
      pricingSnapshot,
    };
  }

  /**
   * task_model_bindings presence is the authorisation: a missing binding is a hard
   * reject, not a fallback to some other model. The "no binding" and "binding
   * deactivated" cases get distinguishable messages, mirroring the default-binding
   * pair below (different operational fixes).
   */
  private async resolveBinding(
    taskType: string,
    modelConfigId: string | undefined,
  ): Promise<task_model_bindings> {
    if (modelConfigId) {
      const binding = await this.repo.findBinding(taskType, modelConfigId);
      if (!binding) {
        throw new BadRequestException(
          `模型未绑定任务: 任务 ${taskType} 与模型 ${modelConfigId} 之间没有配置绑定`,
        );
      }
      if (!binding.isActive) {
        throw new BadRequestException(
          `绑定已停用: 任务 ${taskType} 与模型 ${modelConfigId} 之间的绑定已停用`,
        );
      }
      return binding;
    }

    // findDefaultBinding deliberately does not filter isActive (see
    // TaskPricingRepository) so that "nobody ever configured a default" and "a
    // default exists but was deactivated" surface as different errors here.
    const defaultBinding = await this.repo.findDefaultBinding(taskType);
    if (!defaultBinding) {
      throw new BadRequestException(`任务 ${taskType} 未配置默认模型绑定`);
    }
    if (!defaultBinding.isActive) {
      throw new BadRequestException(`任务 ${taskType} 的默认模型绑定已停用`);
    }
    return defaultBinding;
  }

  /**
   * `value` is `Prisma.JsonValue` — structurally unrelated to `PricingSchema` as far
   * as TypeScript is concerned, so bridging the two requires a cast. That cast is
   * safe here only because it is never used on its own: validatePricingSchema
   * re-checks the *runtime* shape (it is written to tolerate arbitrary DB JSON, not
   * just well-typed input) and throws before the candidate is used for anything.
   * Nothing downstream ever sees the pre-validation value.
   */
  private narrowPricingSchema(value: Prisma.JsonValue, errorMessage: string): PricingSchema {
    const candidate = value as unknown as PricingSchema;
    const violations = validatePricingSchema(candidate);
    if (violations.length > 0) {
      throw new BadRequestException({ message: errorMessage, violations });
    }
    return candidate;
  }

  /** Same reasoning as narrowPricingSchema. Cross-checked against pricingSchema so a
   * term referencing a param the frontend never renders doesn't silently no-op. */
  private narrowParamsSchema(
    value: Prisma.JsonValue,
    pricingSchema: PricingSchema,
    errorMessage: string,
  ): ParamsSchema {
    const candidate = value as unknown as ParamsSchema;
    const violations = validateParamsSchema(candidate, pricingSchema);
    if (violations.length > 0) {
      throw new BadRequestException({ message: errorMessage, violations });
    }
    return candidate;
  }

  /**
   * binding.multiplier is Prisma.Decimal(6,3). `number * Decimal` is NaN, and
   * Math.ceil(NaN) is still NaN — it must never reach quoteTask / an Int column.
   * Convert once, at this boundary, and refuse to proceed on a non-finite result
   * instead of propagating NaN. Mirrors toDiscountRow's Decimal handling.
   */
  private toMultiplier(binding: task_model_bindings): number {
    const multiplier = Number(binding.multiplier);
    if (!Number.isFinite(multiplier)) {
      throw new Error(
        `TaskPricingEstimatorService: binding ${binding.taskType}/${binding.modelConfigId} has a non-numeric multiplier (${String(binding.multiplier)})`,
      );
    }
    return multiplier;
  }
}
