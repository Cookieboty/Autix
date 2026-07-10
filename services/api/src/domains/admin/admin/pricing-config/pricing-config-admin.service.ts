import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  quoteTask,
  validateParamsSchema,
  validatePricingSchema,
  type Breakdown,
  type ParamsSchema,
  type PricingSchema,
} from '@autix/domain/pricing';
import { validateDescription, type LocalizedText } from '@autix/domain/model';
import { PricingConfigAdminRepository } from './pricing-config-admin.repository';
import type { Prisma } from '../../../platform/prisma/generated';

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
 * Admin-only surface for editing a model's paramsSchema/pricingSchema/description and
 * previewing a price before saving. Validation is the whole point here: an operator's typo
 * mis-prices or free-prices real generations, so every write path narrows its `unknown` input
 * through the same domain validators the real charge path trusts, and nothing unvalidated ever
 * reaches the repository or the pricing evaluator.
 */
@Injectable()
export class PricingConfigAdminService {
  constructor(private readonly repo: PricingConfigAdminRepository) {}

  async getModel(modelConfigId: string) {
    const model = await this.repo.findModelConfig(modelConfigId);
    if (!model) throw new NotFoundException(`模型配置不存在: ${modelConfigId}`);
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
    if (!updated) throw new NotFoundException(`模型配置不存在: ${modelConfigId}`);
    return updated;
  }

  async updateModelDescription(modelConfigId: string, description: unknown) {
    const candidate = this.narrowDescription(description);

    const updated = await this.repo.updateModelDescription(
      modelConfigId,
      candidate as unknown as Prisma.InputJsonValue,
    );
    if (!updated) throw new NotFoundException(`模型配置不存在: ${modelConfigId}`);
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
      throw new BadRequestException({ message: 'schema 校验失败', violations });
    }

    return { paramsSchema: paramsCandidate, pricingSchema: pricingCandidate };
  }

  /** Same reasoning as narrowSchemas — the cast never escapes unvalidated. */
  private narrowDescription(raw: unknown): LocalizedText {
    const candidate = raw as unknown as LocalizedText;
    const badLocales = validateDescription(candidate);
    if (badLocales.length > 0) {
      throw new BadRequestException({
        message: `description 含不支持的 locale: ${badLocales.join(', ')}`,
        violations: badLocales,
      });
    }
    return candidate;
  }
}
