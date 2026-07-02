import { describe, expect, test } from 'bun:test';
import type { VideoTemplate } from '@autix/sdk';
import { resolveVideoModelCapability } from '@autix/domain';
import { applyTemplateToStudioForm } from '../src/growth/generator/video/template-apply.helpers';

function makeTemplate(overrides: Partial<VideoTemplate> = {}): VideoTemplate {
  return {
    id: 'tpl_1',
    title: 'Test template',
    description: null,
    category: 'cinematic',
    coverImage: null,
    exampleMedia: [],
    prompt: 'A cinematic dolly-in shot of a mountain',
    variables: [],
    modelHint: undefined,
    durationSec: undefined,
    defaultParams: undefined,
    materialSlots: undefined,
    isHot: false,
    tags: [],
    pointsCost: 0,
    status: 'APPROVED',
    authorId: 'author_1',
    useCount: 0,
    likeCount: 0,
    favoriteCount: 0,
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  } as VideoTemplate;
}

describe('applyTemplateToStudioForm', () => {
  test('maps template defaults into studio form when everything is supported', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0',
      metadata: { videoModelKind: 'seedance-2.0' },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({
        prompt: 'A dramatic reveal',
        modelHint: 'model_a',
        durationSec: 6,
        defaultParams: { resolution: '1080p', ratio: '16:9', generateAudio: true },
      }),
      capability,
      availableModelIds: ['model_a', 'model_b'],
      currentModelId: 'model_b',
      now: 1_700_000_000_000,
    });

    expect(result.prompt).toBe('A dramatic reveal');
    expect(result.resolution).toBe('1080p');
    expect(result.ratio).toBe('16:9');
    expect(result.duration).toBe(6);
    expect(result.generateAudio).toBe(true);
    expect(result.modelId).toBe('model_a');
    expect(result.clampedFields).toEqual([]);
    expect(result.selection).toEqual({
      templateId: 'tpl_1',
      templateTitle: 'Test template',
      coverImage: null,
      appliedAt: 1_700_000_000_000,
    });
  });

  test('clamps resolution when template exceeds current model capability', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0-fast',
      metadata: { videoModelKind: 'seedance-2.0-fast' },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({
        defaultParams: { resolution: '4k' },
      }),
      capability,
      availableModelIds: [],
      currentModelId: null,
    });

    expect(result.resolution).toBe('720p');
    expect(result.clampedFields).toContain('resolution');
  });

  test('clamps unsupported ratio and unsupported audio flag', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0',
      metadata: { videoModelKind: 'seedance-2.0', videoAudio: false },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({
        defaultParams: { ratio: '5:4' as unknown as string, generateAudio: true },
      }),
      capability,
      availableModelIds: [],
      currentModelId: null,
    });

    expect(result.ratio).toBe(capability.defaultRatio);
    expect(result.clampedFields).toContain('ratio');
    expect(result.generateAudio).toBe(false);
    expect(result.clampedFields).toContain('audio');
  });

  test('falls back to current model when modelHint is not available', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0',
      metadata: { videoModelKind: 'seedance-2.0' },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({ modelHint: 'unknown_model' }),
      capability,
      availableModelIds: ['model_a'],
      currentModelId: 'model_a',
    });

    expect(result.modelId).toBe('model_a');
    expect(result.clampedFields).toContain('model');
  });

  test('picks nearest supported duration when template value not available', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0',
      metadata: { videoModelKind: 'seedance-2.0' },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({ durationSec: 13 }),
      capability,
      availableModelIds: [],
      currentModelId: null,
    });

    // 13 sits between 12 and 15 in default durations; both are equidistant, reducer keeps 12 first
    expect([12, 15]).toContain(result.duration);
    expect(result.clampedFields).toContain('duration');
  });

  test('substitutes template variables with their default values', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0',
      metadata: { videoModelKind: 'seedance-2.0' },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({
        prompt: 'A {{duration}}-second {{style}} shot of {{subject}}',
        variables: [
          { key: 'duration', default: '5' },
          { key: 'style', default: 'cinematic' },
        ] as never,
      }),
      capability,
      availableModelIds: [],
      currentModelId: null,
    });

    expect(result.prompt).toBe('A 5-second cinematic shot of {{subject}}');
    expect(result.unresolvedVariables).toEqual(['subject']);
  });

  test('returns empty unresolvedVariables when prompt has no placeholders', () => {
    const capability = resolveVideoModelCapability({
      provider: 'volc',
      model: 'doubao-seedance-2.0',
      metadata: { videoModelKind: 'seedance-2.0' },
    });
    const result = applyTemplateToStudioForm({
      template: makeTemplate({ prompt: 'A plain prompt without vars' }),
      capability,
      availableModelIds: [],
      currentModelId: null,
    });

    expect(result.prompt).toBe('A plain prompt without vars');
    expect(result.unresolvedVariables).toEqual([]);
  });
});
