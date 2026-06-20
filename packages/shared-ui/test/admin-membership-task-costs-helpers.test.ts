import { describe, expect, test } from 'bun:test';
import type { GenerationPricingRule } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  EMPTY_RULE,
  buildPreviewPayload,
  formatRuleCost,
  previewDefaultsForRule,
  ruleToForm,
  sanitizePayload,
  taskDefaults,
} from '../src/admin/membership/task-costs-helpers';

function pricingRule(overrides: Partial<GenerationPricingRule> = {}): GenerationPricingRule {
  return {
    id: 'rule-1',
    taskType: 'chat_message_fast',
    name: 'Fast chat',
    modelProvider: null,
    modelName: null,
    quality: null,
    resolution: null,
    modelTier: null,
    baseUnit: 'message',
    baseCost: 1,
    inputTokenCostPerK: null,
    outputTokenCostPerK: null,
    contextTokenCostPerK: null,
    reasoningMultiplier: null,
    toolCallCost: null,
    batchUnitCost: null,
    referenceImageFixedCost: null,
    referenceImageMultiplier: null,
    videoInputMultiplier: null,
    audioInputMultiplier: null,
    priorityMultiplier: null,
    fixedExtraCost: 0,
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

  test('sanitizes business task payloads using allowed fields and task metadata', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'chat_message_fast')!;

    expect(
      sanitizePayload(
        {
          ...taskDefaults(task),
          modelProvider: ' ignored ',
          modelName: ' ignored-model ',
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
      modelProvider: undefined,
      modelName: undefined,
      quality: undefined,
      resolution: undefined,
      modelTier: 'fast',
      baseUnit: 'message',
      baseCost: 10,
      fixedExtraCost: 0,
      inputTokenCostPerK: 2.5,
      outputTokenCostPerK: null,
      contextTokenCostPerK: null,
      reasoningMultiplier: 1,
      referenceImageFixedCost: null,
      referenceImageMultiplier: null,
      videoInputMultiplier: null,
      audioInputMultiplier: null,
      isActive: false,
    });
  });

  test('keeps custom rule sanitizing limited to the unbound base-cost form', () => {
    expect(
      sanitizePayload({
        ...EMPTY_RULE,
        taskType: ' custom_task ',
        name: ' Custom rule ',
        modelProvider: ' openai ',
        modelName: ' gpt-test ',
        resolution: ' 1024x1024 ',
        baseUnit: '',
        baseCost: '-4',
        fixedExtraCost: '7',
        inputTokenCostPerK: '1',
      }),
    ).toEqual({
      taskType: 'custom_task',
      name: 'Custom rule',
      modelProvider: 'openai',
      modelName: 'gpt-test',
      quality: undefined,
      resolution: '1024x1024',
      modelTier: undefined,
      baseUnit: 'task',
      baseCost: 0,
      fixedExtraCost: 0,
      inputTokenCostPerK: null,
      outputTokenCostPerK: null,
      contextTokenCostPerK: null,
      reasoningMultiplier: 1,
      referenceImageFixedCost: null,
      referenceImageMultiplier: null,
      videoInputMultiplier: null,
      audioInputMultiplier: null,
      isActive: true,
    });
  });

  test('maps rules back to forms with task fallback metadata', () => {
    const task = BUSINESS_TASKS.find((item) => item.taskType === 'gpt_image_2_high')!;

    expect(
      ruleToForm(
        pricingRule({
          taskType: 'gpt_image_2_high',
          name: 'Stored high image',
          baseUnit: 'image',
          baseCost: 360,
          fixedExtraCost: 2,
          quality: null,
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

  test('formats rule cost extras only when values are truthy', () => {
    const t = (key: string, values?: Record<string, string | number>) => `${key}:${JSON.stringify(values ?? {})}`;

    expect(
      formatRuleCost(
        pricingRule({
          baseCost: 12,
          inputTokenCostPerK: '0.5',
          outputTokenCostPerK: '2',
          referenceImageFixedCost: 3,
        }),
        t,
      ),
    ).toBe('cost.baseWithExtras:{"base":12,"extras":"cost.inputPerK:{\\"value\\":\\"0.5\\"} / cost.outputPerK:{\\"value\\":\\"2\\"} / cost.referenceImageFixed:{\\"value\\":3}"}');

    expect(formatRuleCost(pricingRule({ baseCost: 12 }), t)).toBe('12');
  });

  test('builds preview defaults and payloads from the selected rule', () => {
    const rule = pricingRule({
      taskType: 'seedance_720p',
      modelProvider: 'bytedance',
      modelName: 'seedance',
      resolution: '720p',
      baseUnit: 'second',
      inputTokenCostPerK: '1',
      outputTokenCostPerK: null,
    });
    const defaults = previewDefaultsForRule(rule);

    expect(defaults).toEqual({
      quantity: 0,
      seconds: 5,
      inputTokens: 1000,
      outputTokens: 0,
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
