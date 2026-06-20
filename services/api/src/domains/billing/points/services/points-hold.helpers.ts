import { BadRequestException } from '@nestjs/common';
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
}

type HeldGrantItem = Pick<point_hold_items, 'grantId' | 'grantType' | 'amount'>;

export function assertConfirmAmount(actualAmount?: number) {
  if (
    actualAmount !== undefined &&
    (!Number.isInteger(actualAmount) || actualAmount < 0)
  ) {
    throw new BadRequestException('确认扣费金额必须为非负整数');
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
    throw new BadRequestException('确认扣费不能超过冻结金额');
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
