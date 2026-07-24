import { VIDEO_RESOLUTION_OPTIONS, type VideoResolution } from '@autix/domain/video';
import type { MembershipLevel } from '@autix/shared-store';

export type MembershipFeatureConfig = {
  recommended: boolean;
  removeWatermark: boolean;
  commercialLicense: boolean;
  seedance: {
    enabled: boolean;
    maxResolution: VideoResolution;
    maxDurationSeconds: number;
    concurrency: number;
  };
  image: { concurrency: number };
  queuePriority: string;
  batchGeneration: string;
  historyRetentionDays: number;
  teamSpace: boolean;
  invoice: string;
  pointsCarryover: { enabled: boolean; maxCycles: number; maxPoints: number };
};

export const DEFAULT_FEATURES: MembershipFeatureConfig = {
  recommended: false,
  removeWatermark: false,
  commercialLicense: false,
  seedance: {
    enabled: false,
    maxResolution: '720p',
    maxDurationSeconds: 5,
    concurrency: 1,
  },
  image: { concurrency: 1 },
  queuePriority: '',
  batchGeneration: '',
  historyRetentionDays: 30,
  teamSpace: false,
  invoice: '',
  pointsCarryover: { enabled: false, maxCycles: 1, maxPoints: 0 },
};

export function cloneFeatures(features: MembershipFeatureConfig = DEFAULT_FEATURES): MembershipFeatureConfig {
  return {
    ...features,
    seedance: { ...features.seedance },
    image: { ...features.image },
    pointsCarryover: { ...features.pointsCarryover },
  };
}

export function toFeatureConfig(features: MembershipLevel['features'] | unknown): MembershipFeatureConfig {
  if (!features || Array.isArray(features) || typeof features !== 'object') {
    return cloneFeatures();
  }
  const source = features as Record<string, unknown>;
  const seedance = source.seedance && typeof source.seedance === 'object'
    ? source.seedance as Record<string, unknown>
    : {};
  const image = source.image && typeof source.image === 'object'
    ? source.image as Record<string, unknown>
    : {};
  const carryover = source.pointsCarryover && typeof source.pointsCarryover === 'object'
    && !Array.isArray(source.pointsCarryover)
    ? source.pointsCarryover as Record<string, unknown>
    : {};
  const maxResolution = VIDEO_RESOLUTION_OPTIONS.find(
    (option) => option.value === seedance.maxResolution,
  )?.value ?? '720p';
  return {
    recommended: Boolean(source.recommended),
    removeWatermark: Boolean(source.removeWatermark),
    commercialLicense: Boolean(source.commercialLicense),
    seedance: {
      enabled: Boolean(seedance.enabled),
      maxResolution,
      maxDurationSeconds: typeof seedance.maxDurationSeconds === 'number'
        ? seedance.maxDurationSeconds
        : 5,
      concurrency: typeof seedance.concurrency === 'number' ? seedance.concurrency : 1,
    },
    image: { concurrency: typeof image.concurrency === 'number' ? image.concurrency : 1 },
    queuePriority: typeof source.queuePriority === 'string' ? source.queuePriority : '',
    batchGeneration: typeof source.batchGeneration === 'string' ? source.batchGeneration : '',
    historyRetentionDays: typeof source.historyRetentionDays === 'number'
      ? source.historyRetentionDays
      : 30,
    teamSpace: Boolean(source.teamSpace),
    invoice: typeof source.invoice === 'string' ? source.invoice : '',
    pointsCarryover: toCarryoverConfig(carryover),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// 归一化历史/异常值，与运行时校验口径一致
function toCarryoverCycles(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value), 1), 12)
    : 1;
}

function toCarryoverPoints(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

// 启用态 maxPoints 兜底 >=1，避免旧脏数据卡住保存
function toCarryoverConfig(
  carryover: Record<string, unknown>,
): MembershipFeatureConfig['pointsCarryover'] {
  const enabled = carryover.enabled === true;
  const maxPoints = toCarryoverPoints(carryover.maxPoints);
  return {
    enabled,
    maxCycles: toCarryoverCycles(carryover.maxCycles),
    maxPoints: enabled ? Math.max(maxPoints, 1) : maxPoints,
  };
}

export function serializeFeatures(
  config: MembershipFeatureConfig,
  original: unknown = {},
) {
  const base = asRecord(original);
  return {
    ...base,
    recommended: config.recommended,
    removeWatermark: config.removeWatermark,
    commercialLicense: config.commercialLicense,
    seedance: {
      ...asRecord(base.seedance),
      enabled: config.seedance.enabled,
      maxResolution: config.seedance.maxResolution,
      maxDurationSeconds: config.seedance.maxDurationSeconds,
      concurrency: config.seedance.concurrency,
    },
    image: {
      ...asRecord(base.image),
      concurrency: config.image.concurrency,
    },
    queuePriority: config.queuePriority,
    batchGeneration: config.batchGeneration,
    historyRetentionDays: config.historyRetentionDays,
    teamSpace: config.teamSpace,
    invoice: config.invoice,
    pointsCarryover: {
      ...asRecord(base.pointsCarryover),
      enabled: config.pointsCarryover.enabled,
      maxCycles: config.pointsCarryover.maxCycles,
      maxPoints: config.pointsCarryover.maxPoints,
    },
  };
}
