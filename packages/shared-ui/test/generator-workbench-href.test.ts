import {
  buildGeneratorWorkbenchHref,
  GENERATOR_PROMPT_MAX,
} from '../src/growth/generator-workbench-href';

describe('buildGeneratorWorkbenchHref', () => {
  test('image: includes model/prompt/size/quality and always source', () => {
    const href = buildGeneratorWorkbenchHref({
      kind: 'image',
      model: 'gpt-image-1',
      prompt: '  a cat  ',
      size: '1024x1024',
      quality: 'high',
      count: 3,
      templateId: 'tpl_1',
      draftId: 'draft_1',
    });
    expect(href.startsWith('/ai/image?')).toBe(true);
    const q = new URLSearchParams(href.split('?')[1]);
    expect(q.get('model')).toBe('gpt-image-1');
    expect(q.get('prompt')).toBe('a cat');
    expect(q.get('size')).toBe('1024x1024');
    expect(q.get('quality')).toBe('high');
    expect(q.get('count')).toBe('3');
    expect(q.get('templateId')).toBe('tpl_1');
    expect(q.get('draftId')).toBe('draft_1');
    expect(q.get('source')).toBe('public-generator');
  });

  test('image: count omitted when <= 1', () => {
    const q = new URLSearchParams(
      buildGeneratorWorkbenchHref({ kind: 'image', count: 1 }).split('?')[1],
    );
    expect(q.get('count')).toBeNull();
  });

  test('video: uses ratio (not aspectRatio) and encodes generateAudio as 1/0', () => {
    const on = new URLSearchParams(
      buildGeneratorWorkbenchHref({
        kind: 'video',
        model: 'seedance-2.0',
        duration: 8,
        resolution: '1080p',
        ratio: '16:9',
        generateAudio: true,
        mode: 'standard',
        draftId: 'video_draft_1',
      }).split('?')[1],
    );
    expect(on.get('ratio')).toBe('16:9');
    expect(on.has('aspectRatio')).toBe(false);
    expect(on.get('generateAudio')).toBe('1');
    expect(on.get('duration')).toBe('8');
    expect(on.get('draftId')).toBe('video_draft_1');
    const off = new URLSearchParams(
      buildGeneratorWorkbenchHref({ kind: 'video', generateAudio: false }).split('?')[1],
    );
    expect(off.get('generateAudio')).toBe('0');
  });

  test('empty draft still routes with source only', () => {
    expect(buildGeneratorWorkbenchHref({ kind: 'image' })).toBe(
      '/ai/image?source=public-generator',
    );
  });

  test('prompt is capped at GENERATOR_PROMPT_MAX', () => {
    const long = 'x'.repeat(GENERATOR_PROMPT_MAX + 50);
    const q = new URLSearchParams(
      buildGeneratorWorkbenchHref({ kind: 'image', prompt: long }).split('?')[1],
    );
    expect(q.get('prompt')!.length).toBe(GENERATOR_PROMPT_MAX);
  });
});
