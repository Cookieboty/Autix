import type { VideoTemplate } from '@autix/sdk';
import type {
  VideoAspectRatio,
  VideoModelCapability,
  VideoResolution,
} from '@autix/domain';
import {
  normalizeVideoAspectRatio,
  normalizeVideoResolution,
} from '@autix/domain';
import {
  resolvePromptVariables,
  resolveVideoTemplateVariables,
} from '../../../video/workbench/constants';

export type StudioTemplateSelection = {
  templateId: string;
  templateTitle: string;
  coverImage?: string | null;
  appliedAt: number;
};

export type ApplyTemplateResult = {
  prompt: string;
  duration: number;
  resolution: VideoResolution;
  ratio: VideoAspectRatio;
  generateAudio: boolean;
  modelId: string | null;
  selection: StudioTemplateSelection;
  clampedFields: ClampedField[];
  unresolvedVariables: string[];
};

export type ClampedField = 'resolution' | 'duration' | 'ratio' | 'audio' | 'model';

export interface ApplyTemplateInput {
  template: VideoTemplate;
  capability: VideoModelCapability;
  availableModelIds: string[];
  currentModelId: string | null;
  now?: number;
}

function pickResolution(
  requested: unknown,
  capability: VideoModelCapability,
): { value: VideoResolution; clamped: boolean } {
  if (requested == null || requested === '') {
    return { value: capability.defaultResolution, clamped: false };
  }
  const normalized = normalizeVideoResolution(requested);
  if (capability.resolutions.includes(normalized)) {
    return { value: normalized, clamped: false };
  }
  const highestSupported = capability.resolutions[capability.resolutions.length - 1]
    ?? capability.defaultResolution;
  return { value: highestSupported, clamped: true };
}

function pickRatio(
  requested: unknown,
  capability: VideoModelCapability,
): { value: VideoAspectRatio; clamped: boolean } {
  if (requested == null || requested === '') {
    return { value: capability.defaultRatio, clamped: false };
  }
  const normalized = normalizeVideoAspectRatio(requested);
  if (normalized && (capability.ratios as VideoAspectRatio[]).includes(normalized)) {
    return { value: normalized, clamped: false };
  }
  return { value: capability.defaultRatio, clamped: true };
}

function pickDuration(
  requested: unknown,
  capability: VideoModelCapability,
): { value: number; clamped: boolean } {
  const raw = Number(requested);
  if (!Number.isFinite(raw) || raw <= 0) {
    return { value: capability.defaultDuration, clamped: false };
  }
  const rounded = Math.round(raw);
  if (capability.durations.includes(rounded)) {
    return { value: rounded, clamped: false };
  }
  const sorted = [...capability.durations].sort((a, b) => a - b);
  const nearest = sorted.reduce((best, value) => {
    return Math.abs(value - rounded) < Math.abs(best - rounded) ? value : best;
  }, sorted[0] ?? capability.defaultDuration);
  return { value: nearest, clamped: true };
}

function pickGenerateAudio(
  requested: unknown,
  capability: VideoModelCapability,
): { value: boolean; clamped: boolean } {
  if (typeof requested !== 'boolean') {
    return { value: capability.audio, clamped: false };
  }
  if (requested && !capability.audio) {
    return { value: false, clamped: true };
  }
  return { value: requested, clamped: false };
}

function pickModel(
  modelHint: string | null | undefined,
  currentModelId: string | null,
  availableModelIds: string[],
): { value: string | null; clamped: boolean } {
  if (!modelHint) {
    return { value: currentModelId, clamped: false };
  }
  if (availableModelIds.includes(modelHint)) {
    return { value: modelHint, clamped: false };
  }
  return { value: currentModelId, clamped: true };
}

export function applyTemplateToStudioForm(input: ApplyTemplateInput): ApplyTemplateResult {
  const { template, capability, availableModelIds, currentModelId, now } = input;
  const clampedFields: ClampedField[] = [];

  const variableValues = resolveVideoTemplateVariables(template);
  const rawPrompt = template.prompt ?? '';
  const renderedPrompt = resolvePromptVariables(rawPrompt, variableValues);
  const unresolvedVariables = collectUnresolvedVariables(renderedPrompt);

  const resolution = pickResolution(template.defaultParams?.resolution, capability);
  if (resolution.clamped) clampedFields.push('resolution');

  const ratio = pickRatio(template.defaultParams?.ratio, capability);
  if (ratio.clamped) clampedFields.push('ratio');

  const duration = pickDuration(
    template.durationSec ?? variableValues.duration,
    capability,
  );
  if (duration.clamped) clampedFields.push('duration');

  const generateAudio = pickGenerateAudio(template.defaultParams?.generateAudio, capability);
  if (generateAudio.clamped) clampedFields.push('audio');

  const model = pickModel(template.modelHint ?? null, currentModelId, availableModelIds);
  if (model.clamped) clampedFields.push('model');

  return {
    prompt: renderedPrompt,
    duration: duration.value,
    resolution: resolution.value,
    ratio: ratio.value,
    generateAudio: generateAudio.value,
    modelId: model.value,
    selection: {
      templateId: template.id,
      templateTitle: template.title,
      coverImage: template.coverImage ?? null,
      appliedAt: typeof now === 'number' ? now : Date.now(),
    },
    clampedFields,
    unresolvedVariables,
  };
}

function collectUnresolvedVariables(prompt: string): string[] {
  const set = new Set<string>();
  const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    const key = match[1]?.trim();
    if (key) set.add(key);
  }
  return Array.from(set);
}
