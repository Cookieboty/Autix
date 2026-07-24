import { BadRequestException } from '@nestjs/common';
import {
  validatePricingSchema,
  type PricingSchema,
  type PricingSnapshot,
} from '@autix/domain/pricing';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PointsSource,
  type Prisma,
  type point_hold_items,
} from '../../../platform/prisma/generated';
import type { SelectedGrant } from '../points-grants.helpers';

export interface CreateHoldInput {
  taskType: string;
  taskId?: string;
  source?: PointsSource;
  amount: number;
  pricingSnapshot?: Prisma.InputJsonValue;
  refundPolicySnapshot?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  remark?: string;
  /**
   * 设置后，createHold 在同一事务内（advisory lock 串行化）统计该 userId+taskType
   * 的活跃 hold，达到上限即抛 HoldConcurrencyLimitExceededError。把「读计数→建 hold」
   * 收进一个事务，闭合并发闸门的 TOCTOU 竞态。
   */
  concurrencyLimit?: number;
}

/** createHold 原子并发校验命中上限时抛出，由调用域映射成各自的用户可见异常。 */
export class HoldConcurrencyLimitExceededError extends Error {
  constructor(
    readonly taskType: string,
    readonly limit: number,
    readonly activeCount: number,
  ) {
    super(
      `hold concurrency limit exceeded: taskType=${taskType} limit=${limit} active=${activeCount}`,
    );
    this.name = 'HoldConcurrencyLimitExceededError';
  }
}

type HeldGrantItem = Pick<point_hold_items, 'grantId' | 'grantType' | 'amount'>;

export function assertConfirmAmount(actualAmount?: number) {
  if (
    actualAmount !== undefined &&
    (!Number.isInteger(actualAmount) || actualAmount < 0)
  ) {
    throw new BadRequestException('Capture amount must be a non-negative integer');
  }
}

export function isConfirmTerminalStatus(status: PointHoldStatus): boolean {
  return (
    status === PointHoldStatus.CONFIRMED ||
    status === PointHoldStatus.PARTIALLY_REFUNDED ||
    status === PointHoldStatus.REFUNDED
  );
}

export function isRefundTerminalStatus(status: PointHoldStatus): boolean {
  return status === PointHoldStatus.REFUNDED;
}

export function buildHoldCreateData(
  userId: string,
  input: CreateHoldInput,
): Prisma.point_holdsUncheckedCreateInput {
  return {
    userId,
    taskType: input.taskType,
    taskId: input.taskId,
    estimatedAmount: input.amount,
    status: PointHoldStatus.PENDING,
    pricingSnapshot: input.pricingSnapshot,
    refundPolicySnapshot: input.refundPolicySnapshot,
    metadata: input.metadata,
  };
}

export function buildHoldItemCreateData(
  holdId: string,
  item: SelectedGrant,
): Prisma.point_hold_itemsUncheckedCreateInput {
  return {
    holdId,
    grantId: item.grant.id,
    amount: item.amount,
    grantType: item.grant.grantType,
    expiresAt: item.grant.expiresAt,
  };
}

export function buildPendingHoldRecordData(input: {
  userId: string;
  holdId: string;
  createInput: CreateHoldInput;
  balance: number;
}): Prisma.points_recordsUncheckedCreateInput {
  return {
    userId: input.userId,
    type: 'CONSUME',
    amount: input.createInput.amount,
    source: input.createInput.source ?? PointsSource.TASK,
    sourceId: input.createInput.taskId ?? input.holdId,
    balance: input.balance,
    status: 'PENDING',
    holdId: input.holdId,
    remark: input.createInput.remark ?? `generation_freeze:${input.createInput.taskType}`,
  };
}

export function buildHoldConfirmationPlan(input: {
  estimatedAmount: number;
  items: HeldGrantItem[];
  actualAmount?: number;
}): {
  confirmedAmount: number;
  refundAmount: number;
  consumedByType: Map<PointGrantType, number>;
  itemConsumptions: Array<{
    item: HeldGrantItem;
    consumeAmount: number;
    refundAmount: number;
  }>;
} {
  const confirmedAmount = input.actualAmount ?? input.estimatedAmount;
  if (confirmedAmount > input.estimatedAmount) {
    throw new BadRequestException('Capture amount cannot exceed the held amount');
  }

  let remainingToConsume = confirmedAmount;
  const refundAmount = input.estimatedAmount - confirmedAmount;
  const consumedByType = new Map<PointGrantType, number>();
  const itemConsumptions: Array<{
    item: HeldGrantItem;
    consumeAmount: number;
    refundAmount: number;
  }> = [];

  for (const item of input.items) {
    const consumeAmount = Math.min(item.amount, remainingToConsume);
    const itemRefundAmount = item.amount - consumeAmount;
    remainingToConsume -= consumeAmount;
    if (consumeAmount > 0) {
      consumedByType.set(
        item.grantType,
        (consumedByType.get(item.grantType) ?? 0) + consumeAmount,
      );
    }
    itemConsumptions.push({ item, consumeAmount, refundAmount: itemRefundAmount });
  }

  return {
    confirmedAmount,
    refundAmount,
    consumedByType,
    itemConsumptions,
  };
}

export function presentConfirmedHoldStatus(
  confirmedAmount: number,
  refundAmount: number,
): PointHoldStatus {
  return confirmedAmount === 0
    ? PointHoldStatus.REFUNDED
    : refundAmount > 0
      ? PointHoldStatus.PARTIALLY_REFUNDED
      : PointHoldStatus.CONFIRMED;
}

export function buildConfirmHoldUpdateData(
  status: PointHoldStatus,
  confirmedAmount: number,
  refundAmount: number,
): Prisma.point_holdsUncheckedUpdateInput {
  return {
    status,
    confirmedAmount,
    confirmedAt: new Date(),
    refundedAt: refundAmount > 0 ? new Date() : undefined,
  };
}

export function buildConfirmRecordUpdateData(input: {
  status: PointHoldStatus;
  confirmedAmount: number;
  balance: number;
}): Prisma.points_recordsUpdateManyMutationInput {
  return {
    status: input.status === PointHoldStatus.REFUNDED ? 'REFUNDED' : 'CONFIRMED',
    amount: input.confirmedAmount,
    balance: input.balance,
    remark:
      input.status === PointHoldStatus.REFUNDED
        ? PointLedgerEventType.generation_refund
        : PointLedgerEventType.generation_cost,
  };
}

export function sumHoldItemAmount(items: HeldGrantItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function buildRefundHoldUpdateData(): Prisma.point_holdsUncheckedUpdateInput {
  return {
    status: PointHoldStatus.REFUNDED,
    confirmedAmount: 0,
    refundedAt: new Date(),
  };
}

export function buildRefundRecordUpdateData(input: {
  balance: number;
  reason: string;
}): Prisma.points_recordsUpdateManyMutationInput {
  return {
    status: 'REFUNDED',
    balance: input.balance,
    remark: `refund: ${input.reason}`,
  };
}

/** Top-level keys every well-formed snapshot must carry. taskFixedSchema and
 * discountCode are legitimately nullable, so their *presence* isn't checked here —
 * only their value, once we know the snapshot is otherwise well-shaped. */
const REQUIRED_SNAPSHOT_KEYS = [
  'schemaVersion',
  'modelConfigId',
  'modelSchema',
  'multiplier',
  'discountFactor',
  'params',
] as const;

/**
 * 结算读快照的唯一入口。point_holds.pricingSnapshot 是 Json? 列——缺失、被旧引擎
 * 写入的不兼容形状、或字段齐全但结构非法（比如 modelSchema: { terms: [] }），
 * 一律抛 BadRequestException，绝不 fallback 到重新估价。fallback 正是旧引擎
 * pointCostWeight 路径的病根：call-billing.service.ts 曾经吞掉一个
 * BadRequestException 再悄悄换一套公式算价。
 *
 * "缺字段"和"字段都在但值非法"是两条不同的校验路径，报错文案也不同：
 * 旧引擎（pricing-estimator.ts）写的历史 hold 快照形状是
 * { ruleId, taskType, ... }，完全没有 modelSchema/multiplier 等字段，会在下面的
 * 必需字段检查这一步被拒绝，报错里点名具体缺的字段；而"字段都在但 modelSchema
 * 本身校验不过"（比如 terms 为空）是同一条快照结构正确、内容损坏的情况，
 * 会走到 narrowSnapshotSchema 里被 validatePricingSchema 挡下，报错里带
 * violations。这两种失败在运营上是不同的问题（迁移历史数据 vs. 数据损坏排查），
 * 值得用不同的报错区分，即使当前处理方式（都是硬失败）相同。
 */
export function parsePricingSnapshot(raw: Prisma.JsonValue | null): PricingSnapshot {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Hold record is missing the pricing snapshot');
  }
  const snapshot = raw as Record<string, unknown>;

  for (const key of REQUIRED_SNAPSHOT_KEYS) {
    if (!(key in snapshot)) {
      throw new BadRequestException(
        `Pricing snapshot is missing field: ${key} (possibly a snapshot written by the old pricing engine; incompatible shape)`,
      );
    }
  }

  if (typeof snapshot.schemaVersion !== 'number') {
    throw new BadRequestException('Pricing snapshot schemaVersion is not a number');
  }
  if (typeof snapshot.modelConfigId !== 'string') {
    throw new BadRequestException('Pricing snapshot modelConfigId is not a string');
  }
  if (typeof snapshot.multiplier !== 'number') {
    throw new BadRequestException('Pricing snapshot multiplier is not a number');
  }
  if (typeof snapshot.discountFactor !== 'number') {
    throw new BadRequestException('Pricing snapshot discountFactor is not a number');
  }
  if (
    snapshot.params === null ||
    typeof snapshot.params !== 'object' ||
    Array.isArray(snapshot.params)
  ) {
    throw new BadRequestException('Pricing snapshot params is not a valid object');
  }
  const discountCode = snapshot.discountCode;
  if (discountCode !== null && discountCode !== undefined && typeof discountCode !== 'string') {
    throw new BadRequestException('Pricing snapshot discountCode is neither a string nor null');
  }

  const modelSchema = narrowSnapshotSchema(snapshot.modelSchema, 'modelSchema');
  const taskFixedSchemaRaw = snapshot.taskFixedSchema;
  const taskFixedSchema =
    taskFixedSchemaRaw === null || taskFixedSchemaRaw === undefined
      ? null
      : narrowSnapshotSchema(taskFixedSchemaRaw, 'taskFixedSchema');

  return {
    schemaVersion: snapshot.schemaVersion,
    modelConfigId: snapshot.modelConfigId,
    modelSchema,
    taskFixedSchema,
    multiplier: snapshot.multiplier,
    discountFactor: snapshot.discountFactor,
    discountCode: discountCode ?? null,
    params: snapshot.params as Record<string, unknown>,
  };
}

/**
 * `value` came out of a Json column, so it is structurally unrelated to
 * PricingSchema as far as TypeScript is concerned — bridging the two requires a
 * cast. That cast is safe here only because it is never used on its own:
 * validatePricingSchema re-checks the *runtime* shape and this function throws
 * before the candidate is used for anything. Nothing downstream ever sees the
 * pre-validation value. Same reasoning as
 * TaskPricingEstimatorService.narrowPricingSchema.
 */
function narrowSnapshotSchema(value: unknown, field: 'modelSchema' | 'taskFixedSchema'): PricingSchema {
  const candidate = value as unknown as PricingSchema;
  const violations = validatePricingSchema(candidate);
  if (violations.length > 0) {
    throw new BadRequestException({
      message: `Pricing snapshot ${field} structure is invalid`,
      violations,
    });
  }
  return candidate;
}
