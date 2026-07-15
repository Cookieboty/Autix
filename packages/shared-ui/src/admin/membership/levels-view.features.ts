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
};

export function cloneFeatures(features: MembershipFeatureConfig = DEFAULT_FEATURES): MembershipFeatureConfig {
  return {
    ...features,
    seedance: { ...features.seedance },
    image: { ...features.image },
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
  };
}

export function serializeFeatures(features: MembershipFeatureConfig) {
  return {
    ...(features.recommended ? { recommended: true } : {}),
    removeWatermark: features.removeWatermark,
    commercialLicense: features.commercialLicense,
    seedance: {
      enabled: features.seedance.enabled,
      maxResolution: features.seedance.maxResolution,
      maxDurationSeconds: features.seedance.maxDurationSeconds,
      concurrency: features.seedance.concurrency,
    },
    image: { concurrency: features.image.concurrency },
    ...(features.queuePriority ? { queuePriority: features.queuePriority } : {}),
    ...(features.batchGeneration ? { batchGeneration: features.batchGeneration } : {}),
    historyRetentionDays: features.historyRetentionDays,
    ...(features.teamSpace ? { teamSpace: true } : {}),
    ...(features.invoice ? { invoice: features.invoice } : {}),
  };
}
