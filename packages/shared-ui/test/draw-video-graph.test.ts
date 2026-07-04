import { describe, expect, it } from 'bun:test';
import type { DrawElement } from '../src/draw/draw-scene-mapper';
import { VIDEO_NODE_KIND, readVideoComposition } from '../src/draw/draw-video-graph';

const node = (id: string): DrawElement => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  customData: { kind: VIDEO_NODE_KIND },
});

const img = (id: string, url: string): DrawElement => ({
  id,
  type: 'image',
  x: 0,
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

const link = (id: string, from: string, to: string): DrawElement => ({
  id,
  type: 'arrow',
  x: 0,
  y: 0,
  width: 40,
  height: 0,
  startBinding: { elementId: from },
  endBinding: { elementId: to },
});

describe('readVideoComposition', () => {
  it('node alone → text_to_video', () => {
    const spec = readVideoComposition([node('v')], 'v');
    expect(spec.mode).toBe('text_to_video');
  });

  it('single image linked in → image_to_video (first frame)', () => {
    const els = [node('v'), img('a', 'A.png'), link('l1', 'a', 'v')];
    const spec = readVideoComposition(els, 'v');
    expect(spec.mode).toBe('image_to_video');
    expect(spec.firstFrameUrl).toBe('A.png');
  });

  it('multiple images fanned into the node → multiple references', () => {
    const els = [
      node('v'),
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

  it('two images linked to each other → first/last frame by arrow direction', () => {
    const els = [
      node('v'),
      img('a', 'A.png'),
      img('b', 'B.png'),
      link('l1', 'a', 'b'), // A → B: A first, B last
      link('l2', 'b', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');
    expect(spec.mode).toBe('first_last_frame');
    expect(spec.firstFrameUrl).toBe('A.png');
    expect(spec.lastFrameUrl).toBe('B.png');
  });

  it('image→text→image→text→image chain → storyboard shots', () => {
    const els = [
      node('v'),
      img('a', 'A.png'),
      text('t1', '奔跑'),
      img('b', 'B.png'),
      text('t2', '跳跃'),
      img('c', 'C.png'),
      link('l1', 'a', 't1'),
      link('l2', 't1', 'b'),
      link('l3', 'b', 't2'),
      link('l4', 't2', 'c'),
      link('l5', 'c', 'v'),
    ];
    const spec = readVideoComposition(els, 'v');
    expect(spec.mode).toBe('storyboard');
    expect(spec.shots).toEqual([
      { prompt: '奔跑', firstFrameUrl: 'A.png', lastFrameUrl: 'B.png' },
      { prompt: '跳跃', firstFrameUrl: 'B.png', lastFrameUrl: 'C.png' },
    ]);
  });

  it('ignores elements outside the node component', () => {
    const els = [
      node('v'),
      img('a', 'A.png'),
      link('l1', 'a', 'v'),
      img('lonely', 'Z.png'), // not connected to v
    ];
    const spec = readVideoComposition(els, 'v');
    expect(spec.mode).toBe('image_to_video');
    expect(spec.firstFrameUrl).toBe('A.png');
  });
});
