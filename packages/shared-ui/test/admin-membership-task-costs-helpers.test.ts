import { describe, expect, test } from 'bun:test';
import type { GenerationPricingRule, ModelConfigItem, PricingRuleComponent } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  buildPreviewPayload,
  buildPricingModelKey,
  canSharePricingRuleModels,
  formatRuleCost,
  previewDefaultsForRule,
  ruleToForm,
  sanitizePayload,
  scopeOptionsForTask,
  taskDefaults,
} from '../src/admin/membership/task-costs-helpers';

function component(overrides: PricingRuleComponent): PricingRuleComponent {
  return overrides;
}

function pricingRule(overrides: Partial<GenerationPricingRule> = {}): GenerationPricingRule {
  return {
    id: 'rule-1',
    taskType: 'chat_message_fast',
    name: 'Fast chat',
    baseUnit: 'message',
    priority: 0,
    conditions: null,
    components: [{ componentType: 'base', unitCost: 1, sort: 10, isActive: true }],
    isActive: true,
    ...overrides,
  };
}

function systemModel(overrides: Partial<ModelConfigItem> & { metadata?: Record<string, unknown> } = {}): ModelConfigItem {
  const metadata = overrides.metadata as ModelConfigItem['metadata'];
  return {
    id: 'model-1',
    name: 'Model',
    model: 'model',
    provider: 'provider',
    type: 'chat',
    priority: 0,
    isDefault: false,
    capabilities: ['chat'],
    visibility: 'public',
    ...overrides,
    metadata,
  };
}

describe('admin membership task cost helpers', () => {
  test('builds business task defaults without changing field values', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;

    expect(taskDefaults(task)).toMatchObject({
      taskType: 'image_generation',
      name: 'Image generation',
      baseUnit: 'image',
      baseCost: 90,
      qualities: ['medium'],
      isActive: true,
    });
  });

  test('sanitizes business task payloads into conditions and components only', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'chat_message_fast')!;

    expect(
      sanitizePayload(
        {
          ...taskDefaults(task),
          baseCost: '10.8',
          inputTokenCostPerK: '2.5',
          outputTokenCostPerK: '',
          contextTokenCostPerK: '',
          fixedExtraCost: '99',
          isActive: false,
        },
        task,
      ),
    ).toEqual({
      taskType: 'chat_message_fast',
      name: 'Fast chat',
      baseUnit: 'message',
      conditions: { modelTier: { in: ['fast'] } },
      priority: 0,
      components: [
        { componentType: 'base', unitCost: 10, sort: 10, isActive: true },
        { componentType: 'input_token_per_1k', unitCost: 2.5, sort: 30, isActive: true },
      ],
      isActive: false,
    });
  });

  test('exposes model-aware enum scope options for pricing conditions', () => {
    const chatTask = BUSINESS_TASKS.find((item) => item.taskType === 'chat_message_fast')!;
    const imageTask = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;
    const videoTask = BUSINESS_TASKS.find((item) => item.taskType === 'video_generation')!;
    const gptImage = systemModel({
      id: 'gpt-image',
      name: 'GPT Image',
      provider: 'openai',
      model: 'gpt-image-2',
      type: 'image',
      capabilities: ['image'],
    });
    const geminiImage = systemModel({
      id: 'gemini-image',
      name: 'Gemini Image',
      provider: 'google',
      model: 'gemini-2.5-flash-image',
      type: 'image',
      capabilities: ['image'],
    });
    const compatibleImage = systemModel({
      id: 'compatible-image',
      name: 'Flux',
      provider: 'fal',
      model: 'flux-kontext',
      type: 'image',
      capabilities: ['image'],
      metadata: { imageModelKind: 'compatible' },
    });
    const seedanceFast = systemModel({
      id: 'seedance-fast',
      name: 'Seedance Fast',
      provider: 'bytedance',
      model: 'seedance-1.0-pro-fast',
      type: 'video',
      capabilities: ['video'],
    });
    const seedancePro = systemModel({
      id: 'seedance-pro',
      name: 'Seedance Pro',
      provider: 'bytedance',
      model: 'seedance-pro',
      type: 'video',
      capabilities: ['video'],
      metadata: { pricingResolutions: ['480p', '720p', '1080p'] },
    });

    expect(scopeOptionsForTask(chatTask, 'modelTier').map((option) => option.value)).toEqual([
      'fast',
      'standard',
      'pro_reasoning',
    ]);
    expect(scopeOptionsForTask(imageTask, 'quality', [gptImage]).map((option) => option.value)).toEqual([
      'low',
      'medium',
      'high',
    ]);
    expect(scopeOptionsForTask(imageTask, 'quality', [geminiImage]).map((option) => option.value)).toEqual([]);
    expect(scopeOptionsForTask(imageTask, 'quality', [compatibleImage]).map((option) => option.value)).toEqual([
      'standard',
      'hd',
    ]);
    expect(scopeOptionsForTask(imageTask, 'resolution', [gptImage]).map((option) => option.value)).toEqual([
      '1K',
      '2K',
      '4K',
    ]);
    expect(scopeOptionsForTask(imageTask, 'resolution', [geminiImage]).map((option) => option.value)).toEqual([
      '1K',
    ]);
    expect(scopeOptionsForTask(imageTask, 'resolution', [gptImage, geminiImage]).map((option) => option.value)).toEqual([
      '1K',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [seedanceFast]).map((option) => option.value)).toEqual([
      '480p',
      '720p',
      '1080p',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [seedancePro]).map((option) => option.value)).toEqual([
      '480p',
      '720p',
      '1080p',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [seedanceFast, seedancePro]).map((option) => option.value)).toEqual([
      '480p',
      '720p',
      '1080p',
    ]);
  });

  test('uses model-specific Seedance 2.0 resolution scopes', () => {
    const videoTask = BUSINESS_TASKS.find((item) => item.taskType === 'video_generation')!;
    const doubaoSeedanceFast = systemModel({
      id: 'doubao-seedance-fast',
      name: 'doubao-seedance-2.0-fast',
      provider: 'amux',
      model: 'doubao-seedance-2.0-fast',
      type: 'video',
      capabilities: ['video'],
    });
    const doubaoSeedance20 = systemModel({
      id: 'doubao-seedance-20',
      name: 'doubao-seedance-2.0-pro',
      provider: 'amux',
      model: 'doubao-seedance-2.0-pro',
      type: 'video',
      capabilities: ['video'],
    });

    expect(scopeOptionsForTask(videoTask, 'resolution', [doubaoSeedanceFast]).map((option) => option.value)).toEqual([
      '480p',
      '720p',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [doubaoSeedance20]).map((option) => option.value)).toEqual([
      '480p',
      '720p',
      '1080p',
      '4k',
    ]);
  });

  test('exposes image pricing resolution tiers without aspect-ratio sizes', () => {
    const imageTask = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;
    const gptImage = systemModel({
      id: 'gpt-image',
      name: 'GPT Image',
      provider: 'openai',
      model: 'gpt-image-2',
      type: 'image',
      capabilities: ['image'],
    });
    const gemini31Image = systemModel({
      id: 'gemini-image',
      name: 'Gemini 3.1 Image',
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      type: 'image',
      capabilities: ['image'],
    });

    expect(scopeOptionsForTask(imageTask, 'resolution', [gptImage])).toEqual([
      { value: '1K', label: '1K' },
      { value: '2K', label: '2K' },
      { value: '4K', label: '4K' },
    ]);
    expect(scopeOptionsForTask(imageTask, 'resolution', [gemini31Image])).toEqual([
      { value: '512px', label: '512px' },
      { value: '1K', label: '1K' },
      { value: '2K', label: '2K' },
      { value: '4K', label: '4K' },
    ]);
  });

  test('drops invalid enum scope values for preset business task payloads', () => {
    const imageTask = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;
    const videoTask = BUSINESS_TASKS.find((item) => item.taskType === 'video_generation')!;

    const gptImage = systemModel({
      id: 'gpt-image',
      name: 'GPT Image',
      provider: 'openai',
      model: 'gpt-image-2',
      type: 'image',
      capabilities: ['image'],
    });
    const seedancePro = systemModel({
      id: 'seedance-pro',
      name: 'Seedance Pro',
      provider: 'bytedance',
      model: 'seedance-pro',
      type: 'video',
      capabilities: ['video'],
    });

    const imagePayload = sanitizePayload(
      {
        ...taskDefaults(imageTask),
        qualities: ['hd'],
      },
      imageTask,
      [gptImage],
    );
    const videoPayload = sanitizePayload(
      {
        ...taskDefaults(videoTask),
        resolutions: ['4k'],
      },
      videoTask,
      [seedancePro],
    );

    expect(imagePayload.conditions).toBeUndefined();
    expect(videoPayload.conditions).toBeUndefined();
  });

  test('stores model-aware enum scopes as multi-value conditions', () => {
    const imageTask = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;
    const gptImage = systemModel({
      id: 'gpt-image',
      name: 'GPT Image',
      provider: 'openai',
      model: 'gpt-image-2',
      type: 'image',
      capabilities: ['image'],
    });

    expect(
      sanitizePayload(
        {
          ...taskDefaults(imageTask),
          qualities: ['low', 'medium'],
          resolutions: ['1K', '2K'],
        },
        imageTask,
        [gptImage],
      ),
    ).toMatchObject({
      conditions: {
        quality: { in: ['low', 'medium'] },
        resolution: { in: ['1K', '2K'] },
      },
    });
  });

  test('maps rules back to forms from components and task fallback metadata', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;

    expect(
      ruleToForm(
        pricingRule({
          taskType: 'image_generation',
          name: 'Stored high image',
          baseUnit: 'image',
          conditions: { quality: 'high' },
          components: [
            component({ componentType: 'per_image', unitCost: 360, sort: 10, isActive: true }),
            component({ componentType: 'fixed_extra', unitCost: 2, sort: 20, isActive: true }),
          ],
          isActive: false,
        }),
        task,
      ),
    ).toMatchObject({
      id: 'rule-1',
      taskType: 'image_generation',
      name: 'Stored high image',
      baseUnit: 'image',
      baseCost: 360,
      fixedExtraCost: 2,
      qualities: ['high'],
      isActive: false,
    });
  });

  test('only allows model groups with matching pricing parameter signatures', () => {
    const imageTask = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;
    const videoTask = BUSINESS_TASKS.find((item) => item.taskType === 'video_generation')!;
    const gptImageA = systemModel({
      id: 'gpt-image-a',
      name: 'GPT Image A',
      provider: 'openai',
      model: 'gpt-image-2',
      type: 'image',
      capabilities: ['image'],
    });
    const gptImageB = systemModel({
      id: 'gpt-image-b',
      name: 'GPT Image B',
      provider: 'openai',
      model: 'gpt-image-2-preview',
      type: 'image',
      capabilities: ['image'],
    });
    const geminiImage = systemModel({
      id: 'gemini-image',
      name: 'Gemini Image',
      provider: 'google',
      model: 'gemini-2.5-flash-image',
      type: 'image',
      capabilities: ['image'],
    });
    const seedanceFast = systemModel({
      id: 'seedance-fast',
      name: 'Seedance Fast',
      provider: 'bytedance',
      model: 'seedance-1.0-pro-fast',
      type: 'video',
      capabilities: ['video'],
    });
    const seedancePro = systemModel({
      id: 'seedance-pro',
      name: 'Seedance Pro',
      provider: 'bytedance',
      model: 'seedance-pro',
      type: 'video',
      capabilities: ['video'],
      metadata: { pricingResolutions: ['480p', '720p', '1080p'] },
    });

    expect(canSharePricingRuleModels(imageTask, [gptImageA, gptImageB])).toBe(true);
    expect(canSharePricingRuleModels(imageTask, [gptImageA, geminiImage])).toBe(false);
    expect(canSharePricingRuleModels(videoTask, [seedanceFast, seedancePro])).toBe(true);
  });

  test('drops incompatible model keys from sanitized rule payloads', () => {
    const imageTask = BUSINESS_TASKS.find((item) => item.taskType === 'image_generation')!;
    const gptImage = systemModel({
      id: 'gpt-image',
      name: 'GPT Image',
      provider: 'openai',
      model: 'gpt-image-2',
      type: 'image',
      capabilities: ['image'],
    });
    const geminiImage = systemModel({
      id: 'gemini-image',
      name: 'Gemini Image',
      provider: 'google',
      model: 'gemini-2.5-flash-image',
      type: 'image',
      capabilities: ['image'],
    });
    const gptKey = buildPricingModelKey(gptImage.provider, gptImage.model);
    const geminiKey = buildPricingModelKey(geminiImage.provider, geminiImage.model);

    expect(
      sanitizePayload(
        {
          ...taskDefaults(imageTask),
          modelKeys: [gptKey, geminiKey],
        },
        imageTask,
        [gptImage, geminiImage],
      ),
    ).toMatchObject({
      conditions: {
        modelKey: { in: [gptKey] },
      },
    });
  });

  test('stores a selected model group as model key conditions', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'chat_message_fast')!;
    const modelKey = buildPricingModelKey('openai', 'gpt-4o-mini');

    expect(
      sanitizePayload(
        {
          ...taskDefaults(task),
          modelKeys: [modelKey],
        },
        task,
      ),
    ).toMatchObject({
      conditions: { modelKey: { in: [modelKey] }, modelTier: { in: ['fast'] } },
    });
  });

  test('formats costs from components only', () => {
    const t = (key: string, values?: Record<string, string | number>) => `${key}:${JSON.stringify(values ?? {})}`;

    expect(
      formatRuleCost(
        pricingRule({
          components: [
            component({ componentType: 'base', unitCost: 12, sort: 10, isActive: true }),
            component({ componentType: 'input_token_per_1k', unitCost: '0.5', sort: 30, isActive: true }),
            component({ componentType: 'output_token_per_1k', unitCost: '2', sort: 40, isActive: true }),
          ],
        }),
        t,
      ),
    ).toBe('base:12 / input_token_per_1k:0.5 / output_token_per_1k:2');

    expect(formatRuleCost(pricingRule({ components: [] }), t)).toBe('-');
  });

  test('builds preview defaults and payloads from conditions and components', () => {
    const modelKey = buildPricingModelKey('bytedance', 'seedance');
    const rule = pricingRule({
      taskType: 'video_generation',
      baseUnit: 'second',
      conditions: { modelKey: { in: [modelKey] }, resolution: { in: ['720p'] } },
      components: [
        component({ componentType: 'per_second', unitCost: 320, sort: 10, isActive: true }),
        component({ componentType: 'input_token_per_1k', unitCost: '1', sort: 30, isActive: true }),
      ],
    });
    const defaults = previewDefaultsForRule(rule);

    expect(defaults).toEqual({
      quantity: 0,
      seconds: 5,
      inputTokens: 1000,
      outputTokens: 0,
      contextTokens: 0,
      toolCalls: 0,
      mcpCalls: 0,
      skillCalls: 0,
      batchCount: 0,
      referenceImages: 0,
      hasVideoInput: false,
      hasAudioInput: false,
      priority: false,
      membershipLevel: 0,
    });
    expect(buildPreviewPayload(rule, defaults)).toEqual({
      taskType: 'video_generation',
      modelProvider: 'bytedance',
      modelName: 'seedance',
      quality: undefined,
      resolution: '720p',
      modelTier: undefined,
      seconds: 5,
      inputTokens: 1000,
    });
  });

  test('serializes membership and video material conditions for rules and previews', () => {
    const videoTask = BUSINESS_TASKS.find((item) => item.taskType === 'video_generation')!;
    const seedance = systemModel({
      id: 'seedance',
      name: 'Seedance',
      provider: 'bytedance',
      model: 'seedance-pro',
      type: 'video',
      capabilities: ['video'],
    });
    const payload = sanitizePayload(
      {
        ...taskDefaults(videoTask),
        membershipLevels: ['2', '3'],
        requireVideoInput: true,
        requireAudioInput: true,
        requirePriority: true,
        resolutions: ['1080p'],
        minDurationSeconds: 5,
        maxDurationSeconds: 10,
      },
      videoTask,
      [seedance],
      {
        membershipLevels: [
          { name: 'Pro', level: 2, isActive: true },
          { name: 'Ultra', level: 3, isActive: true },
        ],
      },
    );

    expect(payload.conditions).toEqual({
      resolution: { in: ['1080p'] },
      membershipLevel: { in: [2, 3] },
      hasVideoInput: true,
      hasAudioInput: true,
      priority: true,
      seconds: { min: 5, max: 10 },
    });

    const form = ruleToForm(
      pricingRule({
        taskType: 'video_generation',
        baseUnit: 'second',
        conditions: payload.conditions,
      }),
      videoTask,
    );
    expect(form).toMatchObject({
      membershipLevels: ['2', '3'],
      requireVideoInput: true,
      requireAudioInput: true,
      requirePriority: true,
      resolutions: ['1080p'],
      minDurationSeconds: '5',
      maxDurationSeconds: '10',
    });

    const defaults = previewDefaultsForRule(
      pricingRule({
        taskType: 'video_generation',
        baseUnit: 'second',
        conditions: payload.conditions,
      }),
    );
    expect(buildPreviewPayload(
      pricingRule({
        taskType: 'video_generation',
        baseUnit: 'second',
        conditions: payload.conditions,
      }),
      defaults,
    )).toMatchObject({
      taskType: 'video_generation',
      resolution: '1080p',
      seconds: 5,
      hasVideoInput: true,
      hasAudioInput: true,
      priority: true,
      membershipLevel: 2,
    });
  });

  test('inherits membership level scope options from selected model access restrictions', () => {
    const videoTask = BUSINESS_TASKS.find((item) => item.taskType === 'video_generation')!;
    const proSeedance = systemModel({
      id: 'seedance-pro',
      name: 'Seedance Pro',
      provider: 'bytedance',
      model: 'seedance-1.0-pro',
      type: 'video',
      capabilities: ['video'],
      allowedMembershipLevels: [
        { levelId: 'level-pro', level: { id: 'level-pro', name: 'Pro', level: 2 } },
      ],
    });
    const context = {
      membershipLevels: [
        { id: 'level-basic', name: 'Basic', level: 1, isActive: true },
        { id: 'level-pro', name: 'Pro', level: 2, isActive: true },
      ],
    };

    expect(scopeOptionsForTask(videoTask, 'membershipLevel', [proSeedance], context)).toEqual([
      { value: '2', label: 'Pro (2)' },
    ]);
    expect(scopeOptionsForTask(videoTask, 'membershipLevel', undefined, context)).toEqual([
      { value: '1', label: 'Basic (1)' },
      { value: '2', label: 'Pro (2)' },
    ]);

    const payload = sanitizePayload(
      {
        ...taskDefaults(videoTask),
        modelKeys: [buildPricingModelKey(proSeedance.provider, proSeedance.model)],
        membershipLevels: ['1', '2'],
      },
      videoTask,
      [proSeedance],
      context,
    );

    expect(payload.conditions).toMatchObject({
      modelKey: { in: [buildPricingModelKey(proSeedance.provider, proSeedance.model)] },
      membershipLevel: { in: [2] },
    });
  });
});
