import { BadRequestException } from '@nestjs/common';
import {
  PointGrantType,
  type Prisma,
} from '../../platform/prisma/generated';

export type PointGrantRecord = {
  id: string;
  grantType: PointGrantType;
  availableAmount: number;
  frozenAmount: number;
  expiresAt: Date | null;
  usageScope?: Prisma.JsonValue | null;
};

export type SelectedGrant = {
  grant: PointGrantRecord;
  amount: number;
};

export const GRANT_TYPE_BALANCE_FIELD: Record<
  PointGrantType,
  keyof Prisma.user_pointsUpdateInput
> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

const GRANT_TYPE_PRIORITY: Record<PointGrantType, number> = {
  GIFT: 0,
  SUBSCRIPTION: 1,
  COMPENSATION: 2,
  PURCHASED: 3,
};

export function selectGrantsForAmount(
  grants: PointGrantRecord[],
  amount: number,
): SelectedGrant[] {
  const ordered = [...grants].sort((a, b) => {
    const aTime = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return GRANT_TYPE_PRIORITY[a.grantType] - GRANT_TYPE_PRIORITY[b.grantType];
  });

  let remaining = amount;
  const selected: SelectedGrant[] = [];
  for (const grant of ordered) {
    if (remaining <= 0) break;
    const use = Math.min(grant.availableAmount, remaining);
    if (use > 0) {
      selected.push({ grant, amount: use });
      remaining -= use;
    }
  }
  if (remaining > 0) {
    throw new BadRequestException('积分余额不足');
  }
  return selected;
}

export function grantCanBeUsedForTask(
  grant: PointGrantRecord,
  taskType: string,
): boolean {
  const scope = normalizeUsageScope(grant.usageScope);
  if (!scope) return true;

  const allowed = stringArray(scope.allowedTaskTypes);
  if (allowed.length > 0 && !allowed.includes(taskType)) return false;

  const excluded = stringArray(scope.excludedTaskTypes);
  if (excluded.includes(taskType)) return false;

  const allowedPrefixes = stringArray(scope.allowedTaskPrefixes);
  if (
    allowedPrefixes.length > 0 &&
    !allowedPrefixes.some((prefix) => taskType.startsWith(prefix))
  ) {
    return false;
  }

  const excludedPrefixes = stringArray(scope.excludedTaskPrefixes);
  if (excludedPrefixes.some((prefix) => taskType.startsWith(prefix))) return false;

  return true;
}

function normalizeUsageScope(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
