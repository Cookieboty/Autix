import { describe, expect, test } from 'bun:test';
import { resolveImageStudioRequestInputs } from '../src/image/studio/constants';

describe('image studio request inputs', () => {
  test('uses annotated selected source images for edit requests', () => {
    const result = resolveImageStudioRequestInputs({
      selectedSourceImages: [
        { url: 'source-a', prompt: 'original prompt', generationId: 'gen-1', index: 2 },
      ],
      uploadedRefs: [
        { url: 'upload-a', label: 'Uploaded' },
      ],
      referenceAnnotations: {
        'source-a': {
          overlayUrl: 'overlay-a',
          mergedUrl: 'merged-source-a',
          note: 'mark this region',
        },
      },
    });

    expect(result).toEqual({
      sourceImages: [
        {
          url: 'merged-source-a',
          prompt: 'original prompt\nmark this region',
          generationId: 'gen-1',
          index: 2,
        },
      ],
      inputImages: ['upload-a'],
      isEditMode: true,
    });
  });

  test('promotes annotated upload refs to edit sources when no selected source exists', () => {
    const result = resolveImageStudioRequestInputs({
      selectedSourceImages: [],
      uploadedRefs: [
        { url: 'upload-a', label: 'Uploaded' },
        { url: 'upload-b', label: 'Uploaded' },
      ],
      referenceAnnotations: {
        'upload-a': {
          overlayUrl: 'overlay-upload-a',
          mergedUrl: 'merged-upload-a',
          note: 'use this area',
        },
      },
    });

    expect(result).toEqual({
      sourceImages: [
        {
          url: 'merged-upload-a',
          prompt: 'use this area',
          index: 0,
        },
      ],
      inputImages: ['upload-b'],
      isEditMode: true,
    });
  });

  test('keeps plain upload refs as generate input images', () => {
    const result = resolveImageStudioRequestInputs({
      selectedSourceImages: [],
      uploadedRefs: [
        { url: 'upload-a', label: 'Uploaded' },
        { url: 'upload-b', label: 'Uploaded' },
      ],
      referenceAnnotations: {},
    });

    expect(result).toEqual({
      sourceImages: [],
      inputImages: ['upload-a', 'upload-b'],
      isEditMode: false,
    });
  });
});
