import { Prisma } from '../../platform/prisma/generated';

export type CarryoverPolicy = {
  enabled: boolean;
  maxCycles: number;
  maxPoints: number;
};

export type CarryoverSourceGrant = {
  id: string;
  availableAmount: number;
  metadata: Prisma.JsonValue | null;
};

export type CarryoverSelection = {
  eligibleGrants: CarryoverSourceGrant[];
  availableAmount: number;
  carryoverAmount: number;
};

// 结转最多可跨多少个周期的安全上限，防止管理员误配过大的 maxCycles 引起结转链路放大。
export const POINTS_CARRYOVER_MAX_CYCLES = 12;

export function addMonths(from: Date, months: number) {
  const date = new Date(from);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date;
}

export function subtractMonths(from: Date, months: number) {
  return addMonths(from, -months);
}

export function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

export function monthlyCycleIndexesDue(startedAt: Date, expiresAt: Date, now: Date) {
  const indexes: number[] = [];
  for (let index = 1; index <= 120; index++) {
    const cycleStart = addMonths(startedAt, index);
    const cycleEnd = minDate(addMonths(startedAt, index + 1), expiresAt);
    if (cycleStart > now || cycleStart >= expiresAt) break;
    if (cycleEnd <= now) continue;
    indexes.push(index);
  }
  return indexes;
}

export function getCarryoverPolicy(
  features: Prisma.JsonValue | null,
  level: number,
): CarryoverPolicy | null {
  const object = asObject(features);
  const rawPolicy = asObject(object?.pointsCarryover);
  const enabled = rawPolicy?.enabled === true;
  if (!enabled) return null;

  const maxCycles = positiveNumber(rawPolicy.maxCycles, 1);
  const maxPoints = positiveNumber(rawPolicy.maxPoints, 0);
  if (level < 3 || maxCycles < 1 || maxPoints <= 0) return null;
  return {
    enabled: true,
    maxCycles: Math.min(maxCycles, POINTS_CARRYOVER_MAX_CYCLES),
    maxPoints,
  };
}

export function selectCarryoverGrants(
  grants: CarryoverSourceGrant[],
  input: {
    membershipId: string;
    maxPoints: number;
    currentCycleAmount: number;
  },
): CarryoverSelection {
  const eligibleGrants = grants.filter((grant) => {
    const metadata = asObject(grant.metadata);
    return metadata?.membershipId === input.membershipId && metadata?.carryover !== true;
  });
  const availableAmount = eligibleGrants.reduce((sum, grant) => sum + grant.availableAmount, 0);
  const carryoverAmount = Math.min(
    availableAmount,
    input.maxPoints,
    input.currentCycleAmount,
  );
  return { eligibleGrants, availableAmount, carryoverAmount };
}

export function subscriptionCycleSourceId(membershipId: string, cycleIndex: number) {
  return `membership-cycle:${membershipId}:${cycleIndex}`;
}

export function carryoverCycleSourceId(membershipId: string, cycleIndex: number) {
  return `membership-carryover:${membershipId}:${cycleIndex}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function positiveNumber(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}
