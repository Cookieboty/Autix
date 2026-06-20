import { describe, expect, test } from 'bun:test';
import {
  FALLBACK_TEMPLATE_WORKSPACE_MODELS,
  extractGeneratedImageUrls,
  getTemplateWorkspaceModelOptions,
  resolveTemplatePrompt,
  resolveTemplateWorkspaceImageConfig,
} from '../src/template/template-workspace-presenter';

describe('template workspace presenter helpers', () => {
  test('resolves repeated template variables without touching missing values', () => {
    expect(
      resolveTemplatePrompt('Draw {{subject}} as {{subject}} in {{style}}', {
        subject: 'a robot',
        style: 'ink',
      }),
    ).toBe('Draw a robot as a robot in ink');

    expect(resolveTemplatePrompt('Draw {{subject}}', {})).toBe('Draw {{subject}}');
  });

  test('uses configured image model options before fallback values', () => {
    expect(
      getTemplateWorkspaceModelOptions([
        { id: '1', name: 'Model A', model: 'image-a', provider: 'x', capabilities: ['image'] },
        { id: '2', name: 'Model B', model: 'image-b', provider: 'x', capabilities: ['image'] },
      ] as any),
    ).toEqual(['image-a', 'image-b']);

    expect(getTemplateWorkspaceModelOptions([])).toBe(FALLBACK_TEMPLATE_WORKSPACE_MODELS);
  });

  test('resolves image generation client config from model metadata', () => {
    expect(
      resolveTemplateWorkspaceImageConfig(
        [
          {
            id: '1',
            name: 'Model A',
            model: 'image-a',
            provider: 'x',
            capabilities: ['image'],
            metadata: { baseUrl: 'https://amux.test', apiKey: 'secret' },
          },
        ] as any,
        'image-a',
      ),
    ).toEqual({ baseUrl: 'https://amux.test', apiKey: 'secret' });

    expect(resolveTemplateWorkspaceImageConfig([], 'missing')).toBeNull();
  });

  test('extracts generated image urls from base64 and url response items', () => {
    expect(
      extractGeneratedImageUrls({
        data: [
          { b64_json: 'abc123' },
          { url: 'https://cdn.test/image.png' },
          { ignored: true },
        ],
      }),
    ).toEqual(['data:image/png;base64,abc123', 'https://cdn.test/image.png']);

    expect(extractGeneratedImageUrls({ data: null })).toEqual([]);
  });
});
