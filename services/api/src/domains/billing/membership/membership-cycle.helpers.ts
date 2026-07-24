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
  nextCarriedCycles: number;
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
): CarryoverPolicy | null {
  const object = asObject(features);
  const rawPolicy = asObject(object?.pointsCarryover);
  const enabled = rawPolicy?.enabled === true;
  if (!enabled) return null;

  const maxCycles = positiveNumber(rawPolicy.maxCycles, 1);
  const maxPoints = positiveNumber(rawPolicy.maxPoints, 0);
  if (maxCycles < 1 || maxPoints <= 0) return null;
  return {
    enabled: true,
    maxCycles: Math.min(maxCycles, POINTS_CARRYOVER_MAX_CYCLES),
    maxPoints,
  };
}

export function grantAge(metadata: Prisma.JsonValue | null): number {
  const object = asObject(metadata);
  if (object?.carryover !== true) return 0;
  const carried = object.carriedCycles;
  return typeof carried === 'number' && Number.isInteger(carried) && carried >= 1
    ? carried
    : 1;
}

export function selectCarryoverGrants(
  grants: CarryoverSourceGrant[],
  input: {
    membershipId: string;
    maxPoints: number;
    maxCycles: number;
  },
): CarryoverSelection {
  const eligibleGrants = grants.filter((grant) => {
    const metadata = asObject(grant.metadata);
    if (metadata?.membershipId !== input.membershipId) return false;
    return grantAge(grant.metadata) < input.maxCycles;
  });
  const availableAmount = eligibleGrants.reduce((sum, grant) => sum + grant.availableAmount, 0);
  const carryoverAmount = Math.min(availableAmount, input.maxPoints);
  const nextCarriedCycles =
    eligibleGrants.length === 0
      ? 0
      : eligibleGrants.reduce((max, grant) => Math.max(max, grantAge(grant.metadata)), 0) + 1;
  return { eligibleGrants, availableAmount, carryoverAmount, nextCarriedCycles };
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
