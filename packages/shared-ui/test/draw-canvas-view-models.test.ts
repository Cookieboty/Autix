import {
  buildCanvasImageNodeViews,
  normalizeVideoLinkElement,
  orderedImagesFromSequenceEdges,
} from '../src/draw/draw-canvas-view-models';
import type { DrawElement } from '../src/draw/draw-scene-mapper';
import { VIDEO_LINK_KIND } from '../src/draw/draw-video-graph';

function imageElement(overrides: Partial<DrawElement>): DrawElement {
  return {
    id: 'image-1',
    type: 'image',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    customData: { assetUrl: 'https://cdn.test/image.png', label: 'Image' },
    ...overrides,
  };
}

function sequenceEdge(id: string, from: string, to: string): DrawElement {
  return {
    id,
    type: 'arrow',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    startBinding: { elementId: from },
    endBinding: { elementId: to },
    customData: { kind: VIDEO_LINK_KIND, role: 'sequence' },
  };
}

describe('draw canvas view-model helpers', () => {
  it('builds image node screen boxes from Excalidraw zoom and scroll', () => {
    const [view] = buildCanvasImageNodeViews(
      [imageElement({ id: 'image-a' })],
      { zoom: { value: 2 }, scrollX: 5, scrollY: -3 },
      'Untitled',
    );

    expect(view).toMatchObject({
      elementId: 'image-a',
      url: 'https://cdn.test/image.png',
      label: 'Image',
      screenX: 30,
      screenY: 34,
      screenWidth: 200,
      screenHeight: 100,
    });
  });

  it('orders sequence edge image ids from chain starts', () => {
    expect(orderedImagesFromSequenceEdges([
      sequenceEdge('edge-2', 'image-b', 'image-c'),
      sequenceEdge('edge-1', 'image-a', 'image-b'),
    ])).toEqual(['image-a', 'image-b', 'image-c']);
  });

  it('normalizes video link arrows without dropping custom data', () => {
    const normalized = normalizeVideoLinkElement(sequenceEdge('edge-1', 'image-a', 'image-b'));

    expect(normalized).toMatchObject({
      strokeColor: 'transparent',
      backgroundColor: 'transparent',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 0,
      locked: true,
      customData: { kind: VIDEO_LINK_KIND, role: 'sequence' },
    });
  });
});
