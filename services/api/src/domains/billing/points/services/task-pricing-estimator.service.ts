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
    const pricingSnapshot: PricingSnapshot = {
      schemaVersion: model.schemaVersion,
      modelConfigId,
      modelSchema: structuredClone(pricingSchema),
      taskFixedSchema: taskFixedSchema ? structuredClone(taskFixedSchema) : null,
      multiplier,
      discountFactor,
      discountCode,
      params: structuredClone(params),
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
