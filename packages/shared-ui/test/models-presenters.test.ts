import { describe, expect, test } from 'bun:test';
import {
  areAllFilteredModelsSelected,
  filterAmuxModels,
  getAmuxModalities,
  toggleFilteredModelSelection,
  toggleModelSelection,
} from '../src/models/amux-import-presenters';
import {
  buildModelPayload,
  createEmptyEditing,
  editingFromModel,
} from '../src/models/model-editing';

describe('models editing helpers', () => {
  test('creates empty model drafts from host and strips trailing slashes', () => {
    expect(createEmptyEditing('https://amux.example.com/')).toMatchObject({
      provider: 'amux',
      type: 'general',
      capabilities: ['text'],
      baseUrl: 'https://amux.example.com/v1',
    });
  });

  test('maps model config items back into the editing draft shape', () => {
    expect(
      editingFromModel({
        id: 'model-1',
        name: 'GPT',
        model: 'gpt-4o',
        provider: 'amux',
        type: 'code',
        priority: 7,
        isDefault: true,
        capabilities: ['text', 'code'],
        baseUrl: undefined,
        apiKey: undefined,
        metadata: {
          baseUrl: 'https://meta.example.com/v1',
          apiKey: 'secret',
        },
      } as any),
    ).toMatchObject({
      id: 'model-1',
      baseUrl: 'https://meta.example.com/v1',
      apiKey: 'secret',
    });
  });

  test('builds create/update payloads without changing the field names', () => {
    expect(
      buildModelPayload({
        name: '',
        model: 'gpt-4o',
        provider: 'amux',
        type: 'general',
        priority: 1,
        isDefault: false,
        capabilities: ['text'],
        baseUrl: '',
        apiKey: '',
      }),
    ).toEqual({
      name: 'gpt-4o',
      model: 'gpt-4o',
      provider: 'amux',
      type: 'general',
      priority: 1,
      isDefault: false,
      capabilities: ['text'],
      baseUrl: undefined,
      apiKey: undefined,
    });
  });
});

describe('amux import presenters', () => {
  const models = [
    { name: 'a', modality: 'text' },
    { name: 'b', modality: 'image' },
    { name: 'c', modality: 'text' },
  ] as any[];

  test('filters by modality and keeps sorted unique modality lists', () => {
    expect(filterAmuxModels(models, 'text').map((model) => model.name)).toEqual(['a', 'c']);
    expect(filterAmuxModels(models, 'all').map((model) => model.name)).toEqual(['a', 'b', 'c']);
    expect(getAmuxModalities(models)).toEqual(['image', 'text']);
  });

  test('tracks filtered selection state without disturbing other selections', () => {
    const selected = new Set(['a', 'x']);
    const filtered = models.slice(0, 2);

    expect(areAllFilteredModelsSelected(filtered, selected)).toBe(false);
    expect(areAllFilteredModelsSelected(filtered, new Set(['a', 'b']))).toBe(true);
    expect(areAllFilteredModelsSelected([], new Set(['a']))).toBe(false);

    expect(toggleModelSelection(selected, 'b')).toEqual(new Set(['a', 'x', 'b']));
    expect(toggleModelSelection(selected, 'a')).toEqual(new Set(['x']));

    expect(
      toggleFilteredModelSelection(new Set(['x']), filtered, false),
    ).toEqual(new Set(['x', 'a', 'b']));
    expect(
      toggleFilteredModelSelection(new Set(['x', 'a', 'b']), filtered, true),
    ).toEqual(new Set(['x']));
  });
});
