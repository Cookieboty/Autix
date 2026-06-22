import { describe, expect, test } from 'bun:test';
import type { ModelConfigItem } from '@autix/shared-store';
import {
  buildSystemModelPayload,
  createEmptySystemModelForm,
  groupSystemModels,
  readModelError,
  systemModelFormFromModel,
} from '../src/admin/system/system-models-helpers';

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    id: 'model-1',
    name: 'GPT 4o',
    model: 'gpt-4o',
    provider: 'openai',
    type: 'general',
    priority: 10,
    isDefault: true,
    capabilities: ['text', 'vision'],
    baseUrl: null,
    apiKey: null,
    visibility: 'public',
    allowedMembershipLevels: [],
    metadata: { baseUrl: 'https://api.example.com/v1' },
    ...overrides,
  };
}

describe('admin system model helpers', () => {
  test('creates empty amux forms with normalized host url', () => {
    expect(createEmptySystemModelForm('https://api.amux.ai/')).toMatchObject({
      provider: 'amux',
      type: 'general',
      isActive: true,
      capabilities: ['text'],
      allowedMembershipLevelIds: [],
      baseUrl: 'https://api.amux.ai/v1',
    });
  });

  test('maps stored models back to the edit form', () => {
    expect(systemModelFormFromModel(model())).toMatchObject({
      id: 'model-1',
      name: 'GPT 4o',
      model: 'gpt-4o',
      provider: 'openai',
      type: 'general',
      priority: 10,
      isDefault: true,
      isActive: true,
      capabilities: ['text', 'vision'],
      allowedMembershipLevelIds: [],
      baseUrl: 'https://api.example.com/v1',
    });
  });

  test('maps stored membership allowances back to the edit form', () => {
    expect(
      systemModelFormFromModel(
        model({
          allowedMembershipLevels: [
            { levelId: 'level-pro', level: { id: 'level-pro', name: 'Pro', level: 2 } },
            { levelId: 'level-team' },
          ],
        }),
      ).allowedMembershipLevelIds,
    ).toEqual(['level-pro', 'level-team']);
  });

  test('builds payloads with existing fallback semantics', () => {
    expect(
      buildSystemModelPayload({
        ...createEmptySystemModelForm('https://api.amux.ai'),
        name: ' ',
        model: ' gpt-4o-mini ',
        provider: ' ',
        capabilities: [],
        allowedMembershipLevelIds: ['level-pro'],
        baseUrl: ' ',
        apiKey: ' key ',
      }),
    ).toEqual({
      name: 'gpt-4o-mini',
      model: 'gpt-4o-mini',
      provider: 'openai',
      type: 'general',
      priority: 0,
      isDefault: false,
      isActive: true,
      capabilities: ['text'],
      allowedMembershipLevelIds: ['level-pro'],
      baseUrl: undefined,
      apiKey: 'key',
    });
  });

  test('groups models by type with general fallback', () => {
    expect(
      Object.keys(
        groupSystemModels([
          model({ id: 'model-1', type: 'general' }),
          model({ id: 'model-2', type: 'video' }),
          model({ id: 'model-3', type: '' }),
        ]),
      ),
    ).toEqual(['general', 'video']);
  });

  test('reads API errors with fallback', () => {
    expect(readModelError({ response: { data: { msg: 'bad request' } } }, 'fallback')).toBe('bad request');
    expect(readModelError(new Error('failed'), 'fallback')).toBe('failed');
    expect(readModelError({}, 'fallback')).toBe('fallback');
  });
});
