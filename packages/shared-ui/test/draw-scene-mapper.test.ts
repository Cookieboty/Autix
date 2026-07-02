import { describe, expect, it } from 'bun:test';
import {
  DRAW_SCENE_METADATA_KEY,
  type DrawElement,
  boardStateToScene,
  sceneSignature,
  sceneToBoardState,
} from '../src/draw/draw-scene-mapper';

const imageEl = (id: string, url: string, over: Partial<DrawElement> = {}): DrawElement => ({
  id,
  type: 'image',
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  fileId: `file-${id}`,
  customData: { assetUrl: url },
  ...over,
});

const arrowEl: DrawElement = {
  id: 'a1',
  type: 'arrow',
  x: 0,
  y: 0,
  width: 50,
  height: 0,
};

describe('draw-scene-mapper', () => {
  it('maps image elements into image nodes and keeps the raw scene in metadata', () => {
    const state = sceneToBoardState([imageEl('img1', 'https://cdn/x.png'), arrowEl], 3, 't');
    expect(state.boardRevision).toBe(3);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]).toMatchObject({ id: 'img1', kind: 'image', x: 10, y: 20 });
    expect(state.nodes[0].kind === 'image' && state.nodes[0].assetRef).toMatchObject({
      type: 'external',
      url: 'https://cdn/x.png',
    });
    const meta = state.metadata?.[DRAW_SCENE_METADATA_KEY] as { elements: unknown[] };
    expect(meta.elements).toHaveLength(2); // arrow preserved too
  });

  it('round-trips: state -> scene rebuilds elements and image files from asset urls', () => {
    const state = sceneToBoardState([imageEl('img1', 'https://cdn/x.png')], 1, 't');
    const { elements, files } = boardStateToScene(state);
    expect(elements).toHaveLength(1);
    expect(files['file-img1']).toMatchObject({ dataURL: 'https://cdn/x.png', mimeType: 'image/png' });
  });

  it('does not create a file entry for images missing an asset url', () => {
    const el = imageEl('img1', '');
    const state = sceneToBoardState([el], 1, 't');
    const { files } = boardStateToScene(state);
    expect(Object.keys(files)).toHaveLength(0);
  });

  it('signature changes when an element moves', () => {
    const a = sceneSignature([imageEl('img1', 'u')]);
    const b = sceneSignature([imageEl('img1', 'u', { x: 999 })]);
    expect(a).not.toBe(b);
  });
});
