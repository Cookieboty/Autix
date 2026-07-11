import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import { Prisma } from '../../../platform/prisma/generated';

@Injectable()
export class PricingConfigAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Prisma's JSON columns distinguish SQL NULL from a JSON `null` value via a sentinel
   * (`Prisma.JsonNull`) — a bare `null` in `data` is rejected by the generated types (it would
   * be ambiguous). This is the single conversion point for every nullable-Json field this
   * repository writes (fixedCostSchema), matching the same idiom already used in
   * services/api/scripts/seed-pricing.ts and admin.helpers.ts.
   */
  private toNullableJson(value: Prisma.InputJsonValue | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return value === null ? Prisma.JsonNull : value;
  }

  /** Backs `GET /admin/models/:id`: the full description locale map plus the raw schemas, for an operator to edit. */
  async findModelConfig(modelConfigId: string) {
    return this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { id: true, description: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
  }

  /**
   * Returns null when the model does not exist so the service can surface a 404 instead of
   * letting Prisma's update-on-missing-row P2025 escape as an unhandled 500.
   *
   * schemaVersion increments on every write — PricingSnapshot.schemaVersion (quote.ts) is
   * copied into every hold's frozen snapshot for audit ("which schema version priced this
   * order"); if this counter never advanced it would always read 1 and the field would be a lie.
   */
  async updateModelSchemas(
    modelConfigId: string,
    data: { paramsSchema: Prisma.InputJsonValue; pricingSchema: Prisma.InputJsonValue },
  ) {
    const existing = await this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { schemaVersion: true },
    });
    if (!existing) return null;

    return this.prisma.model_configs.update({
      where: { id: modelConfigId },
      data: {
        paramsSchema: data.paramsSchema,
        pricingSchema: data.pricingSchema,
        schemaVersion: existing.schemaVersion + 1,
      },
      select: { id: true, paramsSchema: true, pricingSchema: true, schemaVersion: true },
    });
  }

  /** Same not-found-as-null contract as updateModelSchemas. */
  async updateModelDescription(modelConfigId: string, description: Prisma.InputJsonValue) {
    const existing = await this.prisma.model_configs.findUnique({
      where: { id: modelConfigId },
      select: { id: true },
    });
    if (!existing) return null;

    return this.prisma.model_configs.update({
      where: { id: modelConfigId },
      data: { description },
      select: { id: true, description: true },
    });
  }

  // ---------------------------------------------------------------------
  // task_definitions
  // ---------------------------------------------------------------------

  async listTaskDefinitions() {
    return this.prisma.task_definitions.findMany({ orderBy: { sort: 'asc' } });
  }

  /** taskType is @unique — a duplicate raises P2002; the service translates it to 409. */
  async createTaskDefinition(input: {
    taskType: string;
    name: string;
    category: string;
    fixedCostSchema: Prisma.InputJsonValue | null;
  }) {
    return this.prisma.task_definitions.create({
      data: { ...input, fixedCostSchema: this.toNullableJson(input.fixedCostSchema) },
    });
  }

  /** Missing taskType raises P2025; the service translates it to 404. */
  async updateTaskDefinition(
    taskType: string,
    input: Partial<{
      name: string;
      category: string;
      fixedCostSchema: Prisma.InputJsonValue | null;
      isActive: boolean;
      sort: number;
    }>,
  ) {
    return this.prisma.task_definitions.update({
      where: { taskType },
      data: {
        name: input.name,
        category: input.category,
        isActive: input.isActive,
        sort: input.sort,
        // 'fixedCostSchema' in input distinguishes "field absent from the patch" (undefined —
        // Prisma leaves the column untouched) from "field explicitly set to null" (must become
        // Prisma.JsonNull, not a bare undefined that would also mean "untouched").
        fixedCostSchema: 'fixedCostSchema' in input ? this.toNullableJson(input.fixedCostSchema ?? null) : undefined,
      },
    });
  }

  /**
   * DELETE /admin/task-definitions/:taskType is a soft delete: task_definitions has no
   * deletedAt/isDeleted column, only isActive, and isActive is exactly the field
   * TaskPricingEstimatorService already checks (throwing a clean 400 "任务已停用",
   * never a 500) — so deactivating here is safe and reversible. A hard `.delete()`
   * would cascade (ON DELETE CASCADE) through every task_model_bindings row for this
   * task, permanently destroying multiplier/isDefault configuration an operator may
   * still want. Deliberately never calls `prisma.task_definitions.delete()`.
   */
  async deactivateTaskDefinition(taskType: string) {
    return this.prisma.task_definitions.update({ where: { taskType }, data: { isActive: false } });
  }

  // ---------------------------------------------------------------------
  // task_model_bindings
  // ---------------------------------------------------------------------

  async listTaskModelBindings(taskType?: string) {
    return this.prisma.task_model_bindings.findMany({
      where: taskType ? { taskType } : undefined,
      orderBy: [{ taskType: 'asc' }, { sort: 'asc' }],
      // 带出模型名/model-id，后台绑定页要显示可读名称而不是裸 modelConfigId(cuid)
      include: { modelConfig: { select: { name: true, model: true } } },
    });
  }

  /**
   * The partial unique index `task_model_bindings_one_default_per_task` (`ON
   * (taskType) WHERE isDefault = true`) allows at most one default binding per task.
   * Setting `isDefault: true` therefore clears the task's previous default first, in
   * the same transaction, so a normal "make this the default" click never round-trips
   * through the DB's P2002 for an entirely expected operation. The partial index
   * remains the enforcement of last resort for a genuine concurrent race — the
   * service still translates a P2002 that slips through into a 409.
   */
  async createTaskModelBinding(input: {
    taskType: string;
    modelConfigId: string;
    multiplier: number;
    isDefault: boolean;
  }) {
    if (!input.isDefault) {
      return this.prisma.task_model_bindings.create({ data: input });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.task_model_bindings.updateMany({
        where: { taskType: input.taskType, isDefault: true },
        data: { isDefault: false },
      });
      return tx.task_model_bindings.create({ data: input });
    });
  }

  /** Same clear-then-set transaction as createTaskModelBinding when isDefault is being set to true. */
  async updateTaskModelBinding(
    taskType: string,
    modelConfigId: string,
    input: Partial<{ multiplier: number; isDefault: boolean; isActive: boolean; sort: number }>,
  ) {
    if (!input.isDefault) {
      return this.prisma.task_model_bindings.update({
        where: { taskType_modelConfigId: { taskType, modelConfigId } },
        data: input,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.task_model_bindings.updateMany({
        where: { taskType, isDefault: true },
        data: { isDefault: false },
      });
      return tx.task_model_bindings.update({
        where: { taskType_modelConfigId: { taskType, modelConfigId } },
        data: input,
      });
    });
  }

  async deleteTaskModelBinding(taskType: string, modelConfigId: string) {
    return this.prisma.task_model_bindings.delete({
      where: { taskType_modelConfigId: { taskType, modelConfigId } },
    });
  }

  // ---------------------------------------------------------------------
  // pricing_discounts
  // ---------------------------------------------------------------------

  async listDiscounts() {
    return this.prisma.pricing_discounts.findMany({ orderBy: { priority: 'desc' } });
  }

  /** code is @unique — a duplicate raises P2002; the service translates it to 409. */
  async createDiscount(input: {
    code: string;
    name: string;
    factor: number;
    scope: Prisma.InputJsonValue;
    stackable: boolean;
    priority: number;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
  }) {
    return this.prisma.pricing_discounts.create({ data: input });
  }

  /** Missing id raises P2025; the service translates it to 404. */
  async updateDiscount(
    id: string,
    input: Partial<{
      name: string;
      factor: number;
      scope: Prisma.InputJsonValue;
      stackable: boolean;
      priority: number;
      isActive: boolean;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
    }>,
  ) {
    return this.prisma.pricing_discounts.update({ where: { id }, data: input });
  }

  async deleteDiscount(id: string) {
    return this.prisma.pricing_discounts.delete({ where: { id } });
  }
}
