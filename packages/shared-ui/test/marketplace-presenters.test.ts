import {
  hasTemplatePrompt,
  isTemplateSessionCompatible,
  templateSessionMismatchMessage,
} from '../src/marketplace/resource-detail-presenter';
import {
  getInitialVideoMode,
  getTemplateConversationKind,
  getTemplateDefaults,
  getTemplateReferenceImages,
  materialToAttachment,
  uniqueRefs,
} from '../src/marketplace/marketplace-chat-dock-utils';

describe('marketplace resource detail presenter', () => {
  test('detects template prompt resources by prompt shape', () => {
    expect(hasTemplatePrompt({ prompt: 'draw {{thing}}' } as any)).toBe(true);
    expect(hasTemplatePrompt({ prompt: null } as any)).toBe(false);
    expect(hasTemplatePrompt({ title: 'Skill' } as any)).toBe(false);
  });

  test('keeps template sessions scoped to compatible conversation kinds', () => {
    expect(isTemplateSessionCompatible('IMAGE_TEMPLATE', 'chat')).toBe(true);
    expect(isTemplateSessionCompatible('IMAGE_TEMPLATE', 'image')).toBe(true);
    expect(isTemplateSessionCompatible('IMAGE_TEMPLATE', 'video')).toBe(false);
    expect(isTemplateSessionCompatible('VIDEO_TEMPLATE', 'chat')).toBe(true);
    expect(isTemplateSessionCompatible('VIDEO_TEMPLATE', 'video')).toBe(false);
    expect(isTemplateSessionCompatible('SKILL', 'avatar')).toBe(true);
  });

  test('formats template session mismatch messages with localized labels', () => {
    expect(
      templateSessionMismatchMessage('VIDEO_TEMPLATE', 'image', {
        conversationKinds: {
          video: 'Video',
          image: 'Image',
          avatar: 'Avatar',
          chat: 'Chat',
        },
        compatibleTargets: {
          imageTemplate: 'chat or image sessions',
          videoTemplate: 'chat sessions',
          defaultTarget: 'compatible sessions',
        },
        templateSessionMismatch: '{current} cannot use this. Choose {target}.',
      }),
    ).toBe('Image cannot use this. Choose chat sessions.');
  });
});

describe('marketplace chat dock helpers', () => {
  test('deduplicates reference urls while dropping empty entries', () => {
    expect(
      uniqueRefs([
        { url: 'a' },
        { url: '' },
        { url: 'b' },
        { url: 'a' },
      ]),
    ).toEqual([{ url: 'a' }, { url: 'b' }]);
  });

  test('maps video materials to chat attachments', () => {
    expect(
      materialToAttachment(
        { id: 'clip-1', url: 'https://example.com/clip.mp4', type: 'video' },
        2,
      ),
    ).toEqual({
      id: 'video-material-clip-1-2',
      url: 'https://example.com/clip.mp4',
      name: 'video-material-3',
      mimeType: 'video/mp4',
      size: 0,
      kind: 'video',
    });

    expect(
      materialToAttachment(
        { id: 'sound-1', url: 'https://example.com/audio.mp3', name: 'Voice', type: 'audio' },
        0,
      ).mimeType,
    ).toBe('audio/mpeg');
  });

  test('builds template defaults and reference lists without changing ordering', () => {
    expect(
      getTemplateDefaults([
        { key: 'subject', label: 'Subject', type: 'text', default: 'cat' },
        { key: 'style', label: 'Style', type: 'text' },
      ]),
    ).toEqual({ subject: 'cat', style: '' });

    expect(
      getTemplateReferenceImages(
        {
          coverImage: 'cover',
          exampleImages: ['one', 'cover', 'two'],
        },
        false,
      ),
    ).toEqual(['cover', 'one', 'two']);

    expect(
      getTemplateReferenceImages(
        {
          exampleMedia: ['video-a', 'video-a', 'video-b'],
        },
        true,
      ),
    ).toEqual(['video-a', 'video-b']);
  });

  test('derives dock defaults from resource type and template params', () => {
    expect(getTemplateConversationKind('IMAGE_TEMPLATE')).toBe('image');
    expect(getTemplateConversationKind('VIDEO_TEMPLATE')).toBe('video');
    expect(getTemplateConversationKind('AGENT')).toBe('chat');
    expect(getInitialVideoMode({ defaultParams: { mode: 'first_last_frame' } })).toBe(
      'first_last_frame',
    );
    expect(getInitialVideoMode(null)).toBe('reference');
  });
});
