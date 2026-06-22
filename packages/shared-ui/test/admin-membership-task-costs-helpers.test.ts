import { describe, expect, test } from 'bun:test';
import type { GenerationPricingRule, PricingRuleComponent } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  EMPTY_RULE,
  buildPreviewPayload,
  buildPricingModelKey,
  formatRuleCost,
  previewDefaultsForRule,
  ruleToForm,
  sanitizePayload,
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

describe('admin membership task cost helpers', () => {
  test('builds business task defaults without changing field values', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'gpt_image_2_high')!;

    expect(taskDefaults(task)).toMatchObject({
      taskType: 'gpt_image_2_high',
      name: 'Image workbench High',
      baseUnit: 'image',
      baseCost: 350,
      quality: 'high',
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
      conditions: { modelTier: 'fast' },
      priority: 0,
      components: [
        { componentType: 'base', unitCost: 10, sort: 10, isActive: true },
        { componentType: 'input_token_per_1k', unitCost: 2.5, sort: 30, isActive: true },
      ],
      isActive: false,
    });
  });

  test('keeps custom rule payloads limited to final rule fields', () => {
    expect(
      sanitizePayload({
        ...EMPTY_RULE,
        taskType: ' custom_task ',
        name: ' Custom rule ',
        resolution: ' 1024x1024 ',
        baseUnit: '',
        baseCost: '-4',
        fixedExtraCost: '7',
        inputTokenCostPerK: '1',
      }),
    ).toEqual({
      taskType: 'custom_task',
      name: 'Custom rule',
      baseUnit: 'task',
      priority: 0,
      conditions: { resolution: '1024x1024' },
      components: [],
      isActive: true,
    });
  });

  test('maps rules back to forms from components and task fallback metadata', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'gpt_image_2_high')!;

    expect(
      ruleToForm(
        pricingRule({
          taskType: 'gpt_image_2_high',
          name: 'Stored high image',
          baseUnit: 'image',
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
      taskType: 'gpt_image_2_high',
      name: 'Stored high image',
      baseUnit: 'image',
      baseCost: 360,
      fixedExtraCost: 2,
      quality: 'high',
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
      conditions: { modelKey: { in: [modelKey] }, modelTier: 'fast' },
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
      taskType: 'seedance_720p',
      baseUnit: 'second',
      conditions: { modelKey: { in: [modelKey] }, resolution: '720p' },
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
    });
    expect(buildPreviewPayload(rule, defaults)).toEqual({
      taskType: 'seedance_720p',
      modelProvider: 'bytedance',
      modelName: 'seedance',
      quality: undefined,
      resolution: '720p',
      modelTier: undefined,
      seconds: 5,
      inputTokens: 1000,
    });
  });
});
