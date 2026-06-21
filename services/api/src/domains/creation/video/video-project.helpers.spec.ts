import { VideoClipStatus } from '../../platform/prisma/generated';
import {
  buildPageResult,
  buildSingleClipParams,
  buildUserGeneratedProjectsWhere,
  buildWorkflowTemplateClips,
  normalizeClipParams,
  normalizeClipRecordParams,
  resolveNextClipOrder,
  resolvePrompt,
  resolveTemplateVariables,
} from './video-project.helpers';

describe('video project helpers', () => {
  it('normalizes clip params without mutating the original params', () => {
    const original = {
      ratio: '9:16',
      generate_audio: false,
    };

    expect(normalizeClipParams(original)).toEqual({
      ratio: '9:16',
      generateAudio: false,
    });
    expect(original).toEqual({
      ratio: '9:16',
      generate_audio: false,
    });
  });

  it('keeps explicit camelCase audio params when both audio keys exist', () => {
    expect(
      normalizeClipParams({
        generateAudio: true,
        generate_audio: false,
      }),
    ).toEqual({
      generateAudio: true,
    });
  });

  it('normalizes persisted clip records from json values', () => {
    expect(
      normalizeClipRecordParams({
        id: 'clip-1',
        params: { generate_audio: true, model: 'seedance' },
      }),
    ).toEqual({
      id: 'clip-1',
      params: { generateAudio: true, model: 'seedance' },
    });

    expect(normalizeClipRecordParams({ id: 'clip-2', params: [] })).toEqual({
      id: 'clip-2',
      params: {},
    });
  });

  it('resolves template variables and prompt placeholders', () => {
    const variables = resolveTemplateVariables(
      [
        { key: 'topic', default: 'mountains' },
        { key: 'duration', default: 6 },
        { key: 'ignored-null', default: null },
        { key: 123, default: 'ignored' },
      ],
      { topic: 'ocean' },
    );

    expect(variables).toEqual({
      topic: 'ocean',
      duration: '6',
    });
    expect(resolvePrompt('A {{ topic }} shot for {{duration}}s and {{missing}}', variables))
      .toBe('A ocean shot for 6s and {{missing}}');
  });

  it('builds single-clip params with existing duration precedence', () => {
    expect(
      buildSingleClipParams(
        { ratio: '1:1', duration: '4' },
        7,
        { duration: '8' },
      ),
    ).toEqual({
      ratio: '1:1',
      resolution: '1080p',
      generateAudio: true,
      duration: 8,
    });

    expect(buildSingleClipParams({ duration: '4' }, 7, { duration: '0' }))
      .toEqual({
        ratio: '16:9',
        resolution: '1080p',
        generateAudio: true,
        duration: 4,
      });
    expect(buildSingleClipParams({}, null, {})).toEqual({
      ratio: '16:9',
      resolution: '1080p',
      generateAudio: true,
      duration: 5,
    });
  });

  it('builds workflow template clips with normalized params and default model', () => {
    expect(
      buildWorkflowTemplateClips({
        clipDefs: [
          {
            title: 'Open',
            promptTemplate: 'Scene {{name}} {{ missing }}',
            defaultParams: { generate_audio: false },
            chainFromPrevious: true,
          },
          {
            title: 'Close',
            promptTemplate: null,
            defaultParams: { modelConfigId: 'model-own', generateAudio: false },
            chainFromPrevious: false,
          },
        ],
        variables: { name: 'Ada' },
        defaultVideoModelId: 'model-default',
      }),
    ).toEqual([
      {
        order: 1,
        title: 'Open',
        prompt: 'Scene Ada {{ missing }}',
        params: {
          generateAudio: false,
          modelConfigId: 'model-default',
        },
        chainFromPrev: true,
        status: VideoClipStatus.pending,
      },
      {
        order: 2,
        title: 'Close',
        prompt: '',
        params: {
          modelConfigId: 'model-own',
          generateAudio: false,
        },
        chainFromPrev: false,
        status: VideoClipStatus.pending,
      },
    ]);
  });

  it('builds generated project query helpers', () => {
    expect(buildUserGeneratedProjectsWhere('user-1')).toEqual({
      userId: 'user-1',
      clips: {
        some: {
          generations: {
            some: {},
          },
        },
      },
    });
    expect(
      buildPageResult({
        items: ['p1', 'p2'],
        total: 3,
        page: 1,
        pageSize: 2,
        skip: 0,
      }),
    ).toEqual({
      items: ['p1', 'p2'],
      total: 3,
      page: 1,
      pageSize: 2,
      hasMore: true,
    });
  });

  it('resolves the next clip order from aggregate max order', () => {
    expect(resolveNextClipOrder({ _max: { order: null } })).toBe(1);
    expect(resolveNextClipOrder({ _max: { order: 4 } })).toBe(5);
  });
});
