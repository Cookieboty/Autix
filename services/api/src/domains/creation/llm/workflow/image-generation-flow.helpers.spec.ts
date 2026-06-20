import {
  buildGeneratedImageItems,
  buildImageConversationSummary,
  buildImageConversationContent,
  buildImageGenerationEstimateInput,
  buildImageGenerationHoldMetadata,
  buildImageGenerationHoldRemark,
  buildImageResultMessageMetadata,
  buildPersistedImageVariables,
  buildPromptOptimizeEstimateInput,
  buildPromptOptimizeHoldMetadata,
  buildPromptOptimizeHoldRemark,
  buildPromptRefinementPayload,
  buildPromptSummaryPayload,
  collectPromptImageUrls,
  findLastGeneratedPrompt,
  formatPromptImageRef,
  normalizeImageQuality,
  selectImageReferenceUrl,
  shouldTuneWorkbenchPrompt,
} from './image-generation-flow.helpers';
import type { ResolvedImageRequest } from './image-generation-call-params';

describe('image generation flow helpers', () => {
  it('builds the compact summary with recent user requests and image metadata', () => {
    const summary = buildImageConversationSummary([
      { role: 'USER', content: 'old user note' },
      { role: 'USER', content: 'new user note' },
      {
        role: 'ASSISTANT',
        content: 'suggestion',
        metadata: {
          messageType: 'prompt_suggestion',
          prompt: 'cinematic product prompt',
        },
      },
      {
        role: 'ASSISTANT',
        content: 'image',
        metadata: {
          messageType: 'image_result',
          prompt: 'final prompt',
          images: [{ url: 'https://img.test/one.png', prompt: 'final prompt' }],
        },
      },
    ]);

    expect(summary).toContain('User: old user note');
    expect(summary).toContain('User: new user note');
    expect(summary).toContain('Prompt suggestion: cinematic product prompt');
    expect(summary).toContain('Generated image: https://img.test/one.png | prompt: final prompt');
  });

  it('keeps workbench image references and prompt tuning decisions stable', () => {
    expect(shouldTuneWorkbenchPrompt()).toBe(false);
    expect(shouldTuneWorkbenchPrompt({ promptTuning: '忠实原文' })).toBe(false);
    expect(shouldTuneWorkbenchPrompt({ promptTuning: '更专业' })).toBe(true);
    expect(shouldTuneWorkbenchPrompt({ promptTuning: '更专业', skipPromptTuning: true })).toBe(false);

    expect(
      formatPromptImageRef(
        { url: 'data:image/png;base64,abcdefghijklmnopqrstuvwxyz', prompt: 'logo' },
        0,
        'source prompt',
      ),
    ).toBe('1. [uploaded image data: data:image/png;base64,abcdefghij...] | source prompt: logo');
    expect(
      collectPromptImageUrls(
        [{ url: 'https://img.test/source.png' }],
        [{ url: 'https://img.test/ref.png' }],
      ),
    ).toEqual(['https://img.test/source.png', 'https://img.test/ref.png']);
  });

  it('normalizes pricing quality and finds the latest generated prompt', () => {
    expect(normalizeImageQuality('LOW')).toBe('low');
    expect(normalizeImageQuality('hd')).toBe('high');
    expect(normalizeImageQuality(undefined)).toBe('medium');

    expect(
      findLastGeneratedPrompt([
        { metadata: { messageType: 'image_result', prompt: 'first' } },
        { metadata: { messageType: 'markdown', prompt: 'ignored' } },
        { metadata: { messageType: 'image_result', prompt: 'latest' } },
      ]),
    ).toBe('latest');
  });

  it('builds prompt summary payload with visual context and stable labels', () => {
    const payload = buildPromptSummaryPayload({
      mode: 'edit',
      template: { title: 'Template', prompt: 'Create {{style}} image' },
      variables: { style: 'modern' },
      conversationSummary: 'User: make it brighter',
      lastGeneratedPrompt: 'previous final prompt',
      editInstruction: 'change the background',
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source note' }],
      referenceImages: [{ url: 'https://img.test/ref.png', prompt: 'reference note' }],
    });

    expect(payload.imageUrls).toEqual([
      'https://img.test/source.png',
      'https://img.test/ref.png',
    ]);
    expect(payload.userText).toContain('Mode: edit');
    expect(payload.userText).toContain('Variables: {"style":"modern"}');
    expect(payload.userText).toContain('Last generated prompt: previous final prompt');
    expect(payload.userText).toContain('Source images:\n1. https://img.test/source.png | original prompt: source note');
    expect(payload.userText).toContain(
      'Reference images (visual guidance only, not edit targets):\n1. https://img.test/ref.png | reference note: reference note',
    );
    expect(payload.userText).toContain('Latest edit instruction: change the background');
    expect(payload.userText).toContain('Conversation summary:\nUser: make it brighter');
  });

  it('builds prompt refinement payload from workbench metadata', () => {
    const payload = buildPromptRefinementPayload({
      mode: 'generate',
      template: { title: 'Workbench', prompt: '{{prompt}}' },
      prompt: 'phone poster',
      settings: {
        promptTuning: '电商卖点',
        stylePreset: '产品海报',
        negativePrompt: '低清晰度',
      },
      referenceImages: [{ url: 'data:image/png;base64,abc123', prompt: 'brand colors' }],
    });

    expect(payload.imageUrls).toEqual(['data:image/png;base64,abc123']);
    expect(payload.userText).toContain('Mode: generate');
    expect(payload.userText).toContain('User prompt:\nphone poster');
    expect(payload.userText).toContain('Prompt tuning: 电商卖点');
    expect(payload.userText).toContain('Style preset: 产品海报');
    expect(payload.userText).toContain('Negative prompt: 低清晰度');
    expect(payload.userText).toContain(
      'Reference images:\n1. [uploaded image data: data:image/png;base64,abc123...] | reference note: brand colors',
    );
  });

  it('builds prompt optimization billing inputs without service state', () => {
    const config = {
      id: 'chat-1',
      model: 'gpt-4o-mini',
      provider: 'openai-official',
    };
    const tokens = { inputTokens: 120, outputTokens: 80 };

    expect(
      buildPromptOptimizeEstimateInput('prompt_optimize_generation', config, tokens),
    ).toEqual({
      taskType: 'prompt_optimize_generation',
      modelProvider: 'openai-official',
      modelName: 'gpt-4o-mini',
      inputTokens: 120,
      outputTokens: 80,
    });
    expect(
      buildPromptOptimizeHoldMetadata({
        mode: 'edit',
        prompt: 'edit prompt',
        sourceImages: [{ url: 'https://img.test/source.png' }],
        referenceImages: [{ url: 'https://img.test/ref.png' }],
        config,
        tokens,
      }),
    ).toEqual({
      mode: 'edit',
      promptLength: 11,
      modelConfigId: 'chat-1',
      modelName: 'gpt-4o-mini',
      inputTokens: 120,
      estimatedOutputTokens: 80,
      referenceImages: 2,
    });
    expect(buildPromptOptimizeHoldRemark(config.provider, config.model)).toBe(
      '图片工作台 Prompt AI 优化 · openai-official/gpt-4o-mini',
    );
  });

  it('builds image generation hold and estimate inputs', () => {
    const request: ResolvedImageRequest = {
      mode: 'generate',
      prompt: 'A scene',
      modelConfig: {
        id: 'image-model-1',
        model: 'gpt-image-2',
        provider: 'openai-official',
      },
      template: {},
      variables: {},
      settings: { quality: 'hd', size: '1024x1024' },
      referenceImages: [{ url: 'https://img.test/ref.png' }],
    };

    expect(buildImageGenerationEstimateInput(request, 3)).toEqual({
      taskType: 'gpt_image_2_high',
      modelProvider: 'openai-official',
      modelName: 'gpt-image-2',
      quality: 'high',
      resolution: '1024x1024',
      quantity: 3,
      referenceImages: 1,
    });
    expect(
      buildImageGenerationHoldMetadata(
        {
          templateId: 'tpl-1',
          modelConfigId: 'image-model-1',
          conversationId: 'conv-1',
        },
        request,
      ),
    ).toEqual({
      templateId: 'tpl-1',
      modelConfigId: 'image-model-1',
      conversationId: 'conv-1',
      mode: 'generate',
      prompt: 'A scene',
    });
    expect(buildImageGenerationHoldRemark('gpt_image_2_high')).toBe(
      'image-generation:gpt_image_2_high',
    );
  });

  it('builds generated image persistence payload pieces', () => {
    const request: ResolvedImageRequest = {
      mode: 'edit',
      prompt: 'refined prompt',
      modelConfig: {
        id: 'image-model-1',
        model: 'gpt-image-2',
      },
      template: {},
      variables: { style: 'modern' },
      settings: { quality: 'medium' },
    };
    const sourceImages = [{ url: 'https://cdn.test/source.png', prompt: 'source' }];
    const referenceImages = [{ url: 'https://cdn.test/ref.png', prompt: 'ref' }];
    const images = ['https://cdn.test/1.png', 'https://cdn.test/2.png'];
    const imageItems = buildGeneratedImageItems({
      images,
      generationId: 'gen-1',
      prompt: request.prompt,
      sourceImages,
      referenceImages,
    });

    expect(selectImageReferenceUrl(sourceImages, referenceImages)).toBe(
      'https://cdn.test/source.png',
    );
    expect(buildPersistedImageVariables(request, {
      modelConfigId: 'image-model-1',
      chatModelId: 'chat-1',
    }, sourceImages, referenceImages)).toEqual({
      style: 'modern',
      __workbench: {
        mode: 'edit',
        sourceImages,
        referenceImages,
        settings: { quality: 'medium' },
        modelConfigId: 'image-model-1',
        chatModelId: 'chat-1',
      },
    });
    expect(imageItems).toEqual([
      {
        url: 'https://cdn.test/1.png',
        index: 0,
        generationId: 'gen-1',
        prompt: 'refined prompt',
        sourceImages,
        referenceImages,
      },
      {
        url: 'https://cdn.test/2.png',
        index: 1,
        generationId: 'gen-1',
        prompt: 'refined prompt',
        sourceImages,
        referenceImages,
      },
    ]);
    expect(
      buildImageResultMessageMetadata({
        generationId: 'gen-1',
        templateId: 'tpl-1',
        request,
        images: imageItems,
        sourceImages,
        referenceImages,
      }),
    ).toEqual({
      messageType: 'image_result',
      mode: 'edit',
      generationId: 'gen-1',
      templateId: 'tpl-1',
      model: 'gpt-image-2',
      prompt: 'refined prompt',
      sourceImages,
      referenceImages,
      settings: { quality: 'medium' },
      images: imageItems,
    });
    expect(buildImageConversationContent(images)).toBe(
      '![](https://cdn.test/1.png)\n![](https://cdn.test/2.png)',
    );
  });
});
