import { describe, expect, test } from 'bun:test';
import type { TaskDefinition, TaskModelBinding } from '@autix/shared-store';
import {
  addTaskModelsSequentially,
  applyBulkBindingDraft,
  bindingDraftKey,
  buildTaskBindingPatches,
  buildTaskBindingSummaries,
  filterTaskBindings,
  filterAddableModels,
} from '../src/admin/pricing/task-bindings-helpers';

function binding(overrides: Partial<TaskModelBinding> = {}): TaskModelBinding {
  return {
    taskType: 'chat_message_standard',
    modelConfigId: 'model-1',
    modelName: 'GPT 5',
    model: 'gpt-5',
    multiplier: '2.000',
    isDefault: true,
    isActive: true,
    sort: 0,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

function definition(overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    id: 'task-1',
    taskType: 'chat_message_standard',
    name: 'Standard chat',
    category: 'chat',
    fixedCostSchema: null,
    isActive: true,
    sort: 10,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('task binding workspace helpers', () => {
  test('builds ordered task summaries with readable names and binding health', () => {
    const summaries = buildTaskBindingSummaries(
      [
        binding(),
        binding({ modelConfigId: 'model-2', modelName: 'Kimi', model: 'kimi', isDefault: false, isActive: false }),
        binding({ taskType: 'orphan_task', modelConfigId: 'model-3', modelName: 'Other', isDefault: false }),
      ],
      [
        definition(),
        definition({ id: 'task-2', taskType: 'image_generation', name: 'Image generation', category: 'image', sort: 5 }),
      ],
    );

    expect(summaries.map((summary) => summary.taskType)).toEqual([
      'image_generation',
      'chat_message_standard',
      'orphan_task',
    ]);
    expect(summaries[1]).toMatchObject({
      name: 'Standard chat',
      totalCount: 2,
      activeCount: 1,
      defaultModelName: 'GPT 5',
    });
    expect(summaries[2]).toMatchObject({ name: 'orphan_task', category: 'other' });
  });

  test('filters by model identity and effective draft status', () => {
    const rows = [
      binding(),
      binding({ modelConfigId: 'model-2', modelName: 'Kimi K2.6', model: 'kimi-k2.6', isDefault: false, isActive: false }),
    ];
    const drafts = {
      [bindingDraftKey('chat_message_standard', 'model-2')]: { isActive: true },
    };

    expect(filterTaskBindings(rows, 'k2.6', 'all', drafts).map((row) => row.modelConfigId)).toEqual(['model-2']);
    expect(filterTaskBindings(rows, '', 'active', drafts).map((row) => row.modelConfigId)).toEqual(['model-1', 'model-2']);
    expect(filterTaskBindings(rows, '', 'inactive', drafts)).toEqual([]);
  });

  test('merges multiplier, activation, and a single transactional default update', () => {
    const rows = [
      binding(),
      binding({ modelConfigId: 'model-2', modelName: 'Kimi', model: 'kimi', isDefault: false, isActive: false }),
    ];
    const key = bindingDraftKey('chat_message_standard', 'model-2');
    const result = buildTaskBindingPatches(
      rows,
      { [key]: { multiplierText: '1.5', isActive: true } },
      { chat_message_standard: 'model-2' },
    );

    expect(result.invalidKeys).toEqual([]);
    expect(result.patches).toEqual([
      {
        taskType: 'chat_message_standard',
        modelConfigId: 'model-2',
        data: { multiplier: 1.5, isActive: true, isDefault: true },
      },
    ]);
  });

  test('orders the new default before deactivating the previous default', () => {
    const rows = [
      binding(),
      binding({ modelConfigId: 'model-2', modelName: 'Kimi', model: 'kimi', isDefault: false }),
    ];
    const oldDefaultKey = bindingDraftKey('chat_message_standard', 'model-1');
    const result = buildTaskBindingPatches(
      rows,
      { [oldDefaultKey]: { isActive: false } },
      { chat_message_standard: 'model-2' },
    );

    expect(result.patches).toEqual([
      {
        taskType: 'chat_message_standard',
        modelConfigId: 'model-2',
        data: { isDefault: true },
      },
      {
        taskType: 'chat_message_standard',
        modelConfigId: 'model-1',
        data: { isActive: false },
      },
    ]);
  });

  test('rejects blank, zero, negative, and non-finite multipliers', () => {
    const row = binding();
    for (const multiplierText of ['', '0', '-1', 'Infinity']) {
      const key = bindingDraftKey(row.taskType, row.modelConfigId);
      const result = buildTaskBindingPatches([row], { [key]: { multiplierText } }, {});
      expect(result.invalidKeys).toEqual([key]);
      expect(result.patches).toEqual([]);
    }
  });

  test('applies batch multiplier and activation while protecting the effective default', () => {
    const rows = [
      binding(),
      binding({ modelConfigId: 'model-2', modelName: 'Kimi', model: 'kimi', isDefault: false, isActive: false }),
    ];
    const selected = new Set(['model-1', 'model-2']);
    const multiplierResult = applyBulkBindingDraft({}, rows, selected, { multiplierText: '1.8' });
    expect(multiplierResult.drafts).toEqual({
      [bindingDraftKey('chat_message_standard', 'model-1')]: { multiplierText: '1.8' },
      [bindingDraftKey('chat_message_standard', 'model-2')]: { multiplierText: '1.8' },
    });

    const activeResult = applyBulkBindingDraft(
      multiplierResult.drafts,
      rows,
      selected,
      { isActive: false },
      'model-1',
    );
    expect(activeResult.skippedDefault).toBe(true);
    expect(activeResult.drafts[bindingDraftKey('chat_message_standard', 'model-1')]).toEqual({ multiplierText: '1.8' });
    expect(activeResult.drafts[bindingDraftKey('chat_message_standard', 'model-2')]).toEqual({
      multiplierText: '1.8',
    });
  });

  test('offers only active, unbound models compatible with the task category', () => {
    const models = [
      { id: 'text-1', name: 'Text One', model: 'text-one', provider: 'a', type: 'general', priority: 0, isActive: true, isDefault: false, capabilities: ['text'], visibility: 'public' },
      { id: 'image-1', name: 'Image One', model: 'image-one', provider: 'b', type: 'general', priority: 0, isActive: true, isDefault: false, capabilities: ['image'], visibility: 'public' },
      { id: 'image-2', name: 'Disabled Image', model: 'disabled-image', provider: 'b', type: 'general', priority: 0, isActive: false, isDefault: false, capabilities: ['image'], visibility: 'public' },
      { id: 'image-3', name: 'Metadata Image', model: 'metadata-image', provider: 'b', type: 'general', priority: 0, isActive: true, isDefault: false, capabilities: [], visibility: 'public', metadata: { imageModelKind: 'compatible' } },
      { id: 'video-1', name: 'Video One', model: 'video-one', provider: 'c', type: 'video', priority: 0, isActive: true, isDefault: false, capabilities: ['video'], visibility: 'public' },
      { id: 'reasoning-1', name: 'Reasoning One', model: 'reasoning-one', provider: 'a', type: 'general', priority: 0, isActive: true, isDefault: false, capabilities: ['reasoning'], visibility: 'public' },
    ];

    expect(filterAddableModels(models, new Set(['image-1']), 'image', '').map((model) => model.id)).toEqual(['image-3']);
    expect(filterAddableModels(models, new Set(), 'image', '').map((model) => model.id)).toEqual(['image-1', 'image-3']);
    expect(filterAddableModels(models, new Set(), 'video', '').map((model) => model.id)).toEqual(['video-1']);
    expect(filterAddableModels(models, new Set(), 'chat', '').map((model) => model.id)).toEqual(['reasoning-1', 'text-1']);
  });

  test('continues adding after failures and assigns default to the first successful model', async () => {
    const calls: Array<{ id: string; isDefault: boolean }> = [];
    const result = await addTaskModelsSequentially(
      ['model-1', 'model-2', 'model-3'],
      false,
      async (id, isDefault) => {
        calls.push({ id, isDefault });
        if (id === 'model-1') throw new Error('invalid model');
      },
    );

    expect(calls).toEqual([
      { id: 'model-1', isDefault: true },
      { id: 'model-2', isDefault: true },
      { id: 'model-3', isDefault: false },
    ]);
    expect(result).toEqual({ succeededIds: ['model-2', 'model-3'], failedIds: ['model-1'] });
  });
});
