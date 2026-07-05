import { describe, expect, it } from 'bun:test';
import type { DrawElement } from '../src/draw/draw-scene-mapper';
import { VIDEO_LINK_KIND, VIDEO_NODE_KIND, readVideoComposition } from '../src/draw/draw-video-graph';

const node = (id: string, customData: Record<string, unknown> = {}): DrawElement => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  customData: { kind: VIDEO_NODE_KIND, ...customData },
});

const img = (id: string, url: string, x = 0): DrawElement => ({
  id,
  type: 'image',
  x,
  y: 0,
  width: 100,
  height: 100,
  fileId: `file-${id}`,
  customData: { assetUrl: url },
});

const text = (id: string, value: string): DrawElement => ({
  id,
  type: 'text',
  x: 0,
  y: 0,
  width: 120,
  height: 24,
  text: value,
});

const link = (
  id: string,
  from: string,
  to: string,
  customData?: Record<string, unknown>,
): DrawElement => ({
  id,
  type: 'arrow',
  x: 0,
  y: 0,
  width: 40,
  height: 0,
  startBinding: { elementId: from },
  endBinding: { elementId: to },
  customData,
});

const shotLink = (id: string, from: string, to: string, prompt: string): DrawElement => (
  link(id, from, to, { kind: VIDEO_LINK_KIND, prompt, role: 'sequence' })
);

const issueCodes = (elements: DrawElement[], videoNodeId = 'v'): string[] => (
  readVideoComposition(elements, videoNodeId).issues.map((item) => item.code)
);

describe('readVideoComposition', () => {
  it('node alone -> text_to_video with empty prompt blocking issue', () => {
    const spec = readVideoComposition([node('v')], 'v');

    expect(spec.mode).toBe('text_to_video');
    expect(spec.autoMode).toBe('text_to_video');
    expect(spec.targetVideoNodeId).toBe('v');
    expect(spec.issues).toContainEqual(expect.objectContaining({ code: 'empty-prompt', level: 'blocking' }));
  });

  it('node prompt alone -> clean text_to_video', () => {
    const spec = readVideoComposition([node('v', { prompt: '海边晨跑' })], 'v');

    expect(spec.mode).toBe('text_to_video');
    expect(spec.prompt).toBe('海边晨跑');
    expect(spec.issues).toEqual([]);
  });

  it('single image linked in -> image_to_video first frame', () => {
    const els = [node('v', { prompt: '动起来' }), img('a', 'A.png'), link('l1', 'a', 'v')];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('image_to_video');
    expect(spec.firstFrameUrl).toBe('A.png');
    expect(spec.referenceUrls).toEqual([]);
  });

  it('two tray/input images without image-image sequence line -> reference', () => {
    const els = [
      node('v', { prompt: '保持主体一致', inputElementIds: ['a', 'b'] }),
      img('a', 'A.png'),
      img('b', 'B.png'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('reference');
    expect(spec.referenceUrls).toEqual(['A.png', 'B.png']);
    expect(spec.firstFrameUrl).toBeUndefined();
    expect(spec.lastFrameUrl).toBeUndefined();
  });

  it('grouped input images connected through one member -> reference', () => {
    const els = [
      node('v', { prompt: '把两张图都当参考', inputElementIds: ['a', 'b'], trayOrder: ['a', 'b'] }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      link('l1', 'b', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('reference');
    expect(spec.referenceUrls).toEqual(['A.png', 'B.png']);
    expect(spec.firstFrameUrl).toBeUndefined();
  });

  it('multiple images fanned into the node -> reference images', () => {
    const els = [
      node('v', { prompt: '融合参考' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      img('c', 'C.png'),
      link('l1', 'a', 'v'),
      link('l2', 'b', 'v'),
      link('l3', 'c', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('reference');
    expect(spec.referenceUrls.sort()).toEqual(['A.png', 'B.png', 'C.png']);
  });

  it('two images with an unlabelled image-image line -> first_last_frame by arrow direction', () => {
    const els = [
      node('v', { prompt: '从 A 过渡到 B' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      link('l1', 'a', 'b'),
      link('l2', 'b', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('first_last_frame');
    expect(spec.firstFrameUrl).toBe('A.png');
    expect(spec.lastFrameUrl).toBe('B.png');
    expect(spec.referenceUrls).toEqual([]);
  });

  it('three images with only unlabelled image-image lines still default to reference', () => {
    const els = [
      node('v', { prompt: '参考这些图' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      img('c', 'C.png'),
      link('l1', 'a', 'b'),
      link('l2', 'b', 'c'),
      link('l3', 'c', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('reference');
    expect(spec.referenceUrls.sort()).toEqual(['A.png', 'B.png', 'C.png']);
    expect(spec.shots).toEqual([]);
  });

  it('labelled image-image lines -> storyboard shots ordered by chain', () => {
    const els = [
      node('v', { prompt: '做成短片' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      img('c', 'C.png'),
      shotLink('l1', 'a', 'b', '奔跑'),
      shotLink('l2', 'b', 'c', '跳跃'),
      link('l3', 'c', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('storyboard');
    expect(spec.shotOrder).toEqual(['l1', 'l2']);
    expect(spec.shots).toEqual([
      { prompt: '奔跑', fromElementId: 'a', toElementId: 'b', linkElementId: 'l1', firstFrameUrl: 'A.png', lastFrameUrl: 'B.png' },
      { prompt: '跳跃', fromElementId: 'b', toElementId: 'c', linkElementId: 'l2', firstFrameUrl: 'B.png', lastFrameUrl: 'C.png' },
    ]);
  });

  it('node shotOrder overrides storyboard chain order', () => {
    const els = [
      node('v', { prompt: '做成短片', shotOrder: ['l2', 'l1'] }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      img('c', 'C.png'),
      shotLink('l1', 'a', 'b', '奔跑'),
      shotLink('l2', 'b', 'c', '跳跃'),
      link('l3', 'c', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('storyboard');
    expect(spec.shotOrder).toEqual(['l2', 'l1']);
    expect(spec.shots.map((shot) => shot.prompt)).toEqual(['跳跃', '奔跑']);
  });

  it('empty labelled image-image line is storyboard draft with blocking issue', () => {
    const els = [
      node('v', { prompt: '做成短片' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      link('l1', 'a', 'b', { kind: VIDEO_LINK_KIND, prompt: '', role: 'sequence' }),
      link('l2', 'b', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('storyboard');
    expect(spec.issues).toContainEqual(expect.objectContaining({ code: 'empty-shot-prompt', level: 'blocking' }));
  });

  it('image→text→image chain folds the text node into a storyboard shot (compat)', () => {
    const els = [
      node('v', { prompt: '做成短片' }),
      img('a', 'A.png'),
      text('t1', '奔跑'),
      img('b', 'B.png'),
      link('l1', 'a', 't1'),
      link('l2', 't1', 'b'),
      link('l3', 'b', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.mode).toBe('storyboard');
    expect(spec.shots).toEqual([
      { prompt: '奔跑', fromElementId: 'a', toElementId: 'b', linkElementId: 't1', firstFrameUrl: 'A.png', lastFrameUrl: 'B.png' },
    ]);
    // The text node is uniquely foldable, so no compatibility warning fires.
    expect(spec.issues.some((item) => item.code === 'text-node-compatibility')).toBe(false);
  });

  it('stale userMode does not override automatic reference detection', () => {
    const els = [
      node('v', {
        prompt: '自动参考',
        inputElementIds: ['a', 'b'],
        userMode: 'first_last_frame',
        firstFrameElementId: 'b',
        lastFrameElementId: 'a',
      }),
      img('a', 'A.png'),
      img('b', 'B.png'),
    ];
    const spec = readVideoComposition(els, 'v');

    expect(spec.autoMode).toBe('reference');
    expect(spec.mode).toBe('reference');
    expect(spec.referenceUrls).toEqual(['A.png', 'B.png']);
    expect(spec.firstFrameUrl).toBeUndefined();
    expect(spec.lastFrameUrl).toBeUndefined();
    expect(spec.issues).toEqual([]);
  });

  it('shared leaf image can feed multiple independent video nodes', () => {
    const els = [
      node('v1', { prompt: '第一条' }),
      node('v2', { prompt: '第二条' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      link('l1', 'a', 'v1'),
      link('l2', 'a', 'v2'),
      link('l3', 'b', 'v2'),
    ];

    expect(readVideoComposition(els, 'v1').mode).toBe('image_to_video');
    const second = readVideoComposition(els, 'v2');
    expect(second.mode).toBe('reference');
    expect(second.referenceUrls.sort()).toEqual(['A.png', 'B.png']);
  });

  it('another video node is a traversal boundary', () => {
    const els = [
      node('v1', { prompt: '第一条' }),
      node('v2', { prompt: '第二条' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      link('l1', 'a', 'v1'),
      link('l2', 'v1', 'v2'),
      link('l3', 'b', 'v2'),
    ];

    const spec = readVideoComposition(els, 'v2');
    expect(spec.mode).toBe('image_to_video');
    expect(spec.firstFrameUrl).toBe('B.png');
    expect(spec.sourceElementIds).not.toContain('a');
  });

  it('labelled shot link reaching multiple sinks is blocking', () => {
    const els = [
      node('v1', { prompt: '第一条' }),
      node('v2', { prompt: '第二条' }),
      img('a', 'A.png'),
      img('b', 'B.png'),
      shotLink('l1', 'a', 'b', '奔跑'),
      link('l2', 'b', 'v1'),
      link('l3', 'b', 'v2'),
    ];

    expect(issueCodes(els, 'v1')).toContain('shot-link-multi-sink');
    expect(issueCodes(els, 'v2')).toContain('shot-link-multi-sink');
  });
});
