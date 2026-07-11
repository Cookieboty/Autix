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
  test('creates empty forms with neutral openai provider and empty baseUrl', () => {
    expect(createEmptySystemModelForm()).toMatchObject({
      provider: 'openai',
      type: 'general',
      isActive: true,
      capabilities: ['text'],
      allowedMembershipLevelIds: [],
      baseUrl: '',
    });
  });

  test('maps stored models back to the edit form without pre-filling credentials', () => {
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
      baseUrl: '',
      apiKey: '',
      credentialFieldsDirty: { baseUrl: false, apiKey: false },
    });
  });

  test('maps stored membership allowances back to the edit form and drops unavailable levels', () => {
    expect(
      systemModelFormFromModel(
        model({
          allowedMembershipLevels: [
            { levelId: 'level-pro', level: { id: 'level-pro', name: 'Pro', level: 2 } },
            { levelId: 'level-team' },
          ],
        }),
        { allowedMembershipLevelIds: new Set(['level-pro']) },
      ).allowedMembershipLevelIds,
    ).toEqual(['level-pro']);
  });

  test('builds payloads with existing fallback semantics', () => {
    expect(
      buildSystemModelPayload({
        ...createEmptySystemModelForm(),
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

  test('does not send untouched credential fields when editing', () => {
    expect(
      buildSystemModelPayload({
        ...systemModelFormFromModel(model()),
        baseUrl: 'cookieboty',
        apiKey: 'browser-password',
      }),
    ).toEqual({
      name: 'GPT 4o',
      model: 'gpt-4o',
      provider: 'openai',
      type: 'general',
      priority: 10,
      isDefault: true,
      isActive: true,
      capabilities: ['text', 'vision'],
      allowedMembershipLevelIds: [],
    });

    expect(
      buildSystemModelPayload({
        ...systemModelFormFromModel(model()),
        baseUrl: ' https://new.example.com/v1 ',
        apiKey: ' new-key ',
        credentialFieldsDirty: { baseUrl: true, apiKey: true },
      }),
    ).toMatchObject({
      baseUrl: 'https://new.example.com/v1',
      apiKey: 'new-key',
    });
  });

  test('groups models by capability category (text / image / video), not by type', () => {
    const grouped = groupSystemModels([
      model({ id: 'text-1', type: 'general', capabilities: ['text', 'vision'] }),
      model({ id: 'image-1', type: 'general', capabilities: ['image'] }),
      model({ id: 'video-type', type: 'video', capabilities: ['video'] }),
      model({ id: 'video-cap', type: 'general', capabilities: ['video'] }),
    ]);
    // image models are type='general' but must land in their own group, not with text
    expect(Object.keys(grouped)).toEqual(['text', 'image', 'video']);
    expect(grouped.text.map((m) => m.id)).toEqual(['text-1']);
    expect(grouped.image.map((m) => m.id)).toEqual(['image-1']);
    expect(grouped.video.map((m) => m.id)).toEqual(['video-type', 'video-cap']);
  });

  test('reads API errors with fallback', () => {
    expect(readModelError({ response: { data: { msg: 'bad request' } } }, 'fallback')).toBe('bad request');
    expect(readModelError(new Error('failed'), 'fallback')).toBe('failed');
    expect(readModelError({}, 'fallback')).toBe('fallback');
  });
});
