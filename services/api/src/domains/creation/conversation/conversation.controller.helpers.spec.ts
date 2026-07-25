import {
  appendStreamTokenContent,
  buildAssistantMessageMetadata,
  buildDoneStreamMessage,
  buildDuplicateProcessingStreamError,
  buildErrorStreamMessage,
  buildImageGenerationTaskId,
  buildImagePersistInput,
  buildImageResolveInput,
  buildImageResultStreamMessage,
  buildImageStartStreamMessage,
  buildProcessingRequestHash,
  collectStreamPersistence,
  formatConversationMessage,
  isDuplicateProcessingRequest,
  normalizeChatRequest,
  normalizeChatMessage,
  parsePositiveInt,
  sanitizeChatAttachments,
  sanitizeChatImageUrls,
} from './conversation.controller.helpers';

describe('conversation controller helpers', () => {
  it('sanitizes chat attachments and images using existing accepted shapes', () => {
    expect(
      sanitizeChatAttachments([
        {
          url: 'https://file.test/image.png',
          name: 'image.png',
          mimeType: 'image/png',
          size: 123,
          kind: 'image',
          extra: 'dropped',
        },
        {
          url: 'https://file.test/bad.png',
          name: 'bad.png',
          mimeType: 'image/png',
          size: Number.NaN,
          kind: 'image',
        },
        {
          url: 'https://file.test/unsupported.bin',
          name: 'unsupported.bin',
          mimeType: 'application/octet-stream',
          size: 1,
          kind: 'unsupported',
        },
      ]),
    ).toEqual([
      {
        url: 'https://file.test/image.png',
        name: 'image.png',
        mimeType: 'image/png',
        size: 123,
        kind: 'image',
      },
    ]);

    expect(sanitizeChatImageUrls(['https://img.test/a.png', 1, null])).toEqual([
      'https://img.test/a.png',
    ]);
  });

  it('formats message responses and duplicate request hashes without changing fields', () => {
    const createdAt = new Date('2026-06-20T00:00:00.000Z');
    expect(
      formatConversationMessage({
        id: 'msg-1',
        role: 'ASSISTANT',
        content: 'hello',
        createdAt,
        metadata: {
          messageType: 'markdown',
          durationMs: 12,
          uiStage: 'done',
          retrievedDocuments: [{ id: 'doc-1' }],
          extra: true,
        },
      }),
    ).toEqual({
      id: 'msg-1',
      role: 'ASSISTANT',
      content: 'hello',
      messageType: 'markdown',
      createdAt,
      timestamp: createdAt,
      durationMs: 12,
      metadata: {
        messageType: 'markdown',
        durationMs: 12,
        uiStage: 'done',
        retrievedDocuments: [{ id: 'doc-1' }],
        extra: true,
      },
    });

    const attachments = sanitizeChatAttachments([
      {
        url: 'https://file.test/a.png',
        name: 'a.png',
        mimeType: 'image/png',
        size: 1,
        kind: 'image',
      },
    ]);
    expect(normalizeChatMessage({ text: 'hi' })).toBe('{"text":"hi"}');
    expect(
      buildProcessingRequestHash('hello', ['https://img.test/a.png'], attachments),
    ).toBe('5:hello:1:https://img.test/a.png:1:https://file.test/a.png');
  });

  it('normalizes controller parameters without changing accepted semantics', () => {
    expect(parsePositiveInt('12px')).toBe(12);
    expect(parsePositiveInt('0')).toBeUndefined();
    expect(parsePositiveInt('bad')).toBeUndefined();
    expect(buildImageGenerationTaskId(123)).toBe('img-123');
  });

  it('normalizes chat request payloads and duplicate request checks', () => {
    const normalized = normalizeChatRequest({
      message: 'hello',
      chatModelId: 'chat-model-1',
      images: ['https://img.test/a.png', 'bad'],
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      imageSettings: { size: '1024x1024', quality: 'medium' },
      attachments: [
        {
          url: 'https://file.test/a.png',
          name: 'a.png',
          mimeType: 'image/png',
          size: 1,
          kind: 'image',
        },
      ],
    });

    expect(normalized).toEqual({
      message: 'hello',
      attachments: [
        {
          url: 'https://file.test/a.png',
          name: 'a.png',
          mimeType: 'image/png',
          size: 1,
          kind: 'image',
        },
      ],
      imageUrls: ['https://img.test/a.png', 'bad'],
      requestHash: '5:hello:2:https://img.test/a.png|bad:1:https://file.test/a.png:chat-model-1:https://img.test/source.png:{"size":"1024x1024","quality":"medium"}',
      userMetadata: {
        images: ['https://img.test/a.png', 'bad'],
        attachments: [
          {
            url: 'https://file.test/a.png',
            name: 'a.png',
            mimeType: 'image/png',
            size: 1,
            kind: 'image',
          },
        ],
      },
      streamOptions: {
        images: ['https://img.test/a.png', 'bad'],
        sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
        chatModelId: 'chat-model-1',
        imageSettings: { size: '1024x1024', quality: 'medium' },
      },
    });

    expect(isDuplicateProcessingRequest(
      { hash: normalized.requestHash, timestamp: 1_000 },
      normalized.requestHash,
      10_999,
    )).toBe(true);
    expect(isDuplicateProcessingRequest(
      { hash: normalized.requestHash, timestamp: 1_000 },
      normalized.requestHash,
      11_000,
    )).toBe(false);
    expect(buildDuplicateProcessingStreamError()).toEqual({
      type: 'error',
      message: 'Request is being processed',
    });
  });

  it('builds image generation service inputs and stream messages', () => {
    const body = {
      model: 'image-model-1',
      chatModelId: 'chat-model-1',
      templateId: 'template-1',
      variables: { subject: 'tea' },
      promptOverride: 'make it cinematic',
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      referenceImages: [{ url: 'https://img.test/ref.png', prompt: 'ref' }],
      editInstruction: 'replace cup',
      settings: { size: '1024x1024', quality: 'high' },
    };
    const context = { userId: 'user-1', conversationId: 'conv-1', body };

    expect(buildImageResolveInput(context)).toEqual({
      userId: 'user-1',
      conversationId: 'conv-1',
      templateId: 'template-1',
      modelConfigId: 'image-model-1',
      chatModelId: 'chat-model-1',
      variables: { subject: 'tea' },
      promptOverride: 'make it cinematic',
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      referenceImages: [{ url: 'https://img.test/ref.png', prompt: 'ref' }],
      editInstruction: 'replace cup',
      settings: { size: '1024x1024', quality: 'high' },
    });
    expect(buildImagePersistInput(context)).toEqual({
      userId: 'user-1',
      conversationId: 'conv-1',
      templateId: 'template-1',
      modelConfigId: 'image-model-1',
      variables: { subject: 'tea' },
      promptOverride: 'make it cinematic',
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      referenceImages: [{ url: 'https://img.test/ref.png', prompt: 'ref' }],
      editInstruction: 'replace cup',
      settings: { size: '1024x1024', quality: 'high' },
    });

    const request = {
      mode: 'edit' as const,
      prompt: 'prompt',
      modelConfig: {
        id: 'model-1',
        model: 'gpt-image-2',
      },
      template: {},
      variables: {},
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      referenceImages: [{ url: 'https://img.test/ref.png', prompt: 'ref' }],
    };
    expect(buildImageStartStreamMessage('img-1', request, 2, 'ts')).toEqual({
      messageType: 'image_editing',
      timestamp: 'ts',
      payload: {
        taskId: 'img-1',
        model: 'gpt-image-2',
        count: 2,
        sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      },
    });

    expect(buildImageResultStreamMessage(
      'img-1',
      request,
      {
        generation: {},
        images: [{ url: 'https://img.test/out.png', index: 0, generationId: 'gen-1', prompt: 'prompt' }],
        prompt: 'prompt',
        model: 'gpt-image-2',
        appliedSettings: {
          count: 1,
          coerced: false,
          notes: [],
          kind: 'gpt-image',
        },
      },
      'ts',
    )).toEqual({
      messageType: 'image_result',
      timestamp: 'ts',
      payload: {
        taskId: 'img-1',
        images: [{ url: 'https://img.test/out.png', index: 0, generationId: 'gen-1', prompt: 'prompt' }],
        prompt: 'prompt',
        model: 'gpt-image-2',
        sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
        referenceImages: [{ url: 'https://img.test/ref.png', prompt: 'ref' }],
        appliedSettings: {
          count: 1,
          coerced: false,
          notes: [],
          kind: 'gpt-image',
        },
      },
    });
  });

  it('builds terminal stream messages and assistant persistence metadata', () => {
    expect(buildDoneStreamMessage(undefined, 'ts')).toEqual({
      messageType: 'done',
      timestamp: 'ts',
      payload: null,
    });
    expect(buildDoneStreamMessage(25, 'ts')).toEqual({
      messageType: 'done',
      timestamp: 'ts',
      payload: { durationMs: 25 },
    });
    expect(buildErrorStreamMessage(new Error('boom'), 'ts')).toEqual({
      messageType: 'error',
      timestamp: 'ts',
      payload: { error: 'boom' },
    });
    expect(buildAssistantMessageMetadata(undefined, 25)).toEqual({
      messageType: 'markdown',
      durationMs: 25,
    });
    expect(buildAssistantMessageMetadata({ messageType: 'prompt_suggestion', prompt: 'x' }, 25)).toEqual({
      messageType: 'prompt_suggestion',
      prompt: 'x',
      durationMs: 25,
    });
  });

  it('collects stream persistence content and suggestion metadata', () => {
    let draft = collectStreamPersistence({ content: '' }, {
      type: 'llm_token',
      stepKey: 'chat',
      content: 'hello',
    });
    draft = collectStreamPersistence(draft, {
      type: 'llm_token',
      stepKey: 'chat',
      content: ' world',
    });
    expect(draft).toEqual({ content: 'hello world' });
    expect(appendStreamTokenContent('hello', {
      type: 'prompt_suggestion',
      prompt: 'better prompt',
      model: 'model-1',
      reasoning: 'why',
    })).toBe('hello');

    expect(collectStreamPersistence(draft, {
      type: 'prompt_suggestion',
      prompt: 'better prompt',
      model: 'model-1',
      reasoning: 'why',
    })).toEqual({
      content: 'better prompt',
      metadata: {
        messageType: 'prompt_suggestion',
        prompt: 'better prompt',
        model: 'model-1',
        reasoning: 'why',
      },
    });

    expect(collectStreamPersistence(draft, {
      type: 'edit_suggestion',
      instruction: 'replace background',
      sourceImages: [{ url: 'https://img.test/source.png' }],
      model: 'model-1',
      reasoning: 'why',
    })).toEqual({
      content: 'replace background',
      metadata: {
        messageType: 'edit_suggestion',
        instruction: 'replace background',
        sourceImages: [{ url: 'https://img.test/source.png' }],
        model: 'model-1',
        reasoning: 'why',
      },
    });
  });
});
