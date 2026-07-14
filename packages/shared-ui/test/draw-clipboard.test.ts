import {
  copiedCanvasImagesFromJson,
  isLikelyExcalidrawClipboardText,
} from '../src/draw/draw-clipboard';

const imageElement = {
  id: 'img-1',
  type: 'image',
  x: 12,
  y: 34,
  width: 260,
  height: 160,
  customData: {
    assetUrl: 'https://cdn.test/image.png',
    label: 'source image',
  },
};

describe('draw clipboard helpers', () => {
  it('extracts copied canvas images from Excalidraw clipboard JSON', () => {
    const copied = copiedCanvasImagesFromJson(JSON.stringify({
      type: 'excalidraw/clipboard',
      elements: [imageElement],
    }));

    expect(copied).toEqual([{
      url: 'https://cdn.test/image.png',
      label: 'source image',
      x: 12,
      y: 34,
      width: 260,
      height: 160,
    }]);
  });

  it('does not hijack mixed image and non-image Excalidraw clipboard data', () => {
    const copied = copiedCanvasImagesFromJson(JSON.stringify({
      type: 'excalidraw/clipboard',
      elements: [
        imageElement,
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 80, height: 24, text: 'caption' },
      ],
    }));

    expect(copied).toBeNull();
  });

  it('recognizes Excalidraw clipboard text payloads', () => {
    expect(isLikelyExcalidrawClipboardText(JSON.stringify({
      type: 'excalidraw/clipboard',
      elements: [imageElement],
    }))).toBe(true);
    expect(isLikelyExcalidrawClipboardText('https://cdn.test/image.png')).toBe(false);
  });
});
