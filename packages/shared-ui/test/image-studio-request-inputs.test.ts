import { describe, expect, test } from 'bun:test';
import {
  mergeHistorySettings,
  resolveImageStudioRequestInputs,
  type ImageStudioModelSettings,
} from '../src/image/studio/constants';
import {
  buildImageStudioGeneratePayload,
  buildImageStudioRefinePayload,
} from '../src/image/studio/requestInputs';

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
        'generation:gen-1:2': {
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
        'url:upload-a:0': {
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

  test('keeps annotations isolated for duplicate reference urls', () => {
    const result = resolveImageStudioRequestInputs({
      selectedSourceImages: [
        { url: 'same-url', prompt: 'first source', annotationKey: 'material:m1' },
        { url: 'same-url', prompt: 'second source', annotationKey: 'material:m2' },
      ],
      uploadedRefs: [],
      referenceAnnotations: {
        'material:m2': {
          overlayUrl: 'overlay-second',
          mergedUrl: 'merged-second',
          note: 'only second image mark',
        },
      },
    });

    expect(result.sourceImages).toEqual([
      { url: 'same-url', prompt: 'first source', annotationKey: 'material:m1' },
      {
        url: 'merged-second',
        prompt: 'second source\nonly second image mark',
        annotationKey: 'material:m2',
      },
    ]);
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

describe('image studio history settings', () => {
  const current: ImageStudioModelSettings = {
    size: '1024x1024',
    quality: 'standard',
    count: 2,
    guidanceScale: 7,
    steps: 28,
    seed: '',
    promptTuning: 'auto',
    stylePreset: 'general',
    negativePrompt: '',
  };

  test('merges reusable history settings while fixing image count to one', () => {
    const merged = mergeHistorySettings(
      current,
      {
        id: 'task-1',
        prompt: 'cat',
        resolvedPrompt: 'cat',
        modelUsed: 'model-a',
        modelConfigId: 'model-config-a',
        chatModelId: null,
        status: 'completed',
        settings: {
          size: 123,
          quality: 'hd',
          count: 99,
          guidanceScale: '8.5',
          steps: 32,
          seed: 42,
          promptTuning: 'faithful',
          stylePreset: 'commercial',
          negativePrompt: 'blur',
        },
        images: ['image-a'],
        generatedImages: [],
        sourceImages: [],
        referenceImages: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      4,
    );

    expect(merged).toEqual({
      size: '123',
      quality: 'hd',
      count: 1,
      guidanceScale: 8.5,
      steps: 32,
      seed: '42',
      promptTuning: 'faithful',
      stylePreset: 'commercial',
      negativePrompt: 'blur',
    });
  });

  test('does not restore image count from history images', () => {
    const merged = mergeHistorySettings(
      current,
      {
        id: 'task-2',
        prompt: 'dog',
        resolvedPrompt: 'dog',
        modelUsed: 'model-b',
        modelConfigId: null,
        chatModelId: null,
        status: 'completed',
        settings: {},
        images: [],
        generatedImages: ['image-a', 'image-b', 'image-c'],
        sourceImages: [],
        referenceImages: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      8,
    );

    expect(merged).toMatchObject({
      size: current.size,
      quality: current.quality,
      count: 1,
      guidanceScale: current.guidanceScale,
      steps: current.steps,
      promptTuning: current.promptTuning,
      stylePreset: current.stylePreset,
    });
  });
});

describe('image studio request payloads', () => {
  test('builds generate payload for plain reference inputs', () => {
    expect(buildImageStudioGeneratePayload({
      finalPrompt: 'draw a cat',
      selectedSourceImages: [],
      uploadedRefs: [{ url: 'upload-a', label: 'Uploaded' }],
      referenceAnnotations: {},
    })).toEqual({
      promptOverride: 'draw a cat',
      inputImages: ['upload-a'],
    });
  });

  test('builds edit payload when selected source images exist', () => {
    expect(buildImageStudioGeneratePayload({
      finalPrompt: 'make it brighter',
      selectedSourceImages: [{ url: 'source-a', prompt: 'original' }],
      uploadedRefs: [],
      referenceAnnotations: {},
    })).toEqual({
      editInstruction: 'make it brighter',
      sourceImages: [{ url: 'source-a', prompt: 'original' }],
    });
  });

  test('builds refined prompt payload with trimmed prompt and edit mode', () => {
    expect(buildImageStudioRefinePayload({
      prompt: '  improve the lighting  ',
      selectedSourceImages: [{ url: 'source-a' }],
      uploadedRefs: [{ url: 'upload-a', label: 'Uploaded' }],
      referenceAnnotations: {},
    })).toEqual({
      prompt: 'improve the lighting',
      mode: 'edit',
      sourceImages: [{ url: 'source-a' }],
      inputImages: ['upload-a'],
    });
  });
});
