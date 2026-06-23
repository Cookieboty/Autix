import { describe, expect, test } from 'bun:test';
import type { GenerationPricingRule, ModelConfigItem, PricingRuleComponent } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  buildPreviewPayload,
  buildPricingModelKey,
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
      model: 'seedance-fast',
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
      'auto',
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
      'auto',
      '1024x1024',
      '1536x1024',
      '1024x1536',
      '2048x2048',
      '2048x1152',
      '3840x2160',
      '2160x3840',
    ]);
    expect(scopeOptionsForTask(imageTask, 'resolution', [geminiImage]).map((option) => option.value)).toContain('2016x864');
    expect(scopeOptionsForTask(imageTask, 'resolution', [gptImage, geminiImage]).map((option) => option.value)).toEqual([
      '1024x1024',
      '1536x1024',
      '1024x1536',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [seedanceFast]).map((option) => option.value)).toEqual([
      '720p',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [seedancePro]).map((option) => option.value)).toEqual([
      '480p',
      '720p',
      '1080p',
    ]);
    expect(scopeOptionsForTask(videoTask, 'resolution', [seedanceFast, seedancePro]).map((option) => option.value)).toEqual([
      '720p',
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
          resolutions: ['1024x1024', '2048x2048'],
        },
        imageTask,
        [gptImage],
      ),
    ).toMatchObject({
      conditions: {
        quality: { in: ['low', 'medium'] },
        resolution: { in: ['1024x1024', '2048x2048'] },
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
          conditions: { quality: 'high', usesTemplate: true },
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
      usesTemplate: true,
      isActive: false,
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
      conditions: { modelKey: { in: [modelKey] }, resolution: { in: ['720p'] }, usesTemplate: true },
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
      usesTemplate: true,
      hasVideoInput: false,
      hasAudioInput: false,
      priority: false,
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
      usesTemplate: true,
    });
  });
});
