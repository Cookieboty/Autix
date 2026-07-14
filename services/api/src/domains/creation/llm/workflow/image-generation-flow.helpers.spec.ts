import {
  buildCompletedImageGenerationRepositoryInput,
  buildGeneratedImageItems,
  buildImageConversationSummary,
  buildImageConversationContent,
  buildImageGenerationEstimateInput,
  buildImageGenerationHoldCreateInput,
  buildImageGenerationHoldMetadata,
  buildImageGenerationHoldRemark,
  buildImageGenerationSuccessResult,
  buildImageResultMessageMetadata,
  buildPersistedImageVariables,
  buildPromptOptimizeEstimateInput,
  buildPromptOptimizeHoldCreateInput,
  buildPromptOptimizeHoldMetadata,
  buildPromptOptimizeHoldRemark,
  buildPromptRefinementPayload,
  buildPromptSummaryPayload,
  buildRefineWorkbenchPromptPlan,
  buildRefineWorkbenchPromptResult,
  buildResolvedImageRequest,
  buildWorkbenchHumanMessageContent,
  collectPromptImageUrls,
  findLastGeneratedPrompt,
  formatPromptImageRef,
  getUploadFailureLogDetails,
  normalizeImageGenerationCount,
  normalizeImageQuality,
  normalizePromptOverride,
  resolvePersistedGenerationId,
  resolveImageRequestMode,
  selectImageReferenceUrl,
  shouldTuneWorkbenchPrompt,
  supportsImagePromptChatModel,
  supportsImagePromptVision,
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
    expect(shouldTuneWorkbenchPrompt({ promptTuning: 'faithful' })).toBe(false);
    expect(shouldTuneWorkbenchPrompt({ promptTuning: 'photoDetail' })).toBe(true);
    expect(shouldTuneWorkbenchPrompt({ promptTuning: 'photoDetail', skipPromptTuning: true })).toBe(false);

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

  it('normalizes pricing quality without collapsing model-specific values and finds the latest generated prompt', () => {
    expect(normalizeImageQuality('LOW')).toBe('low');
    expect(normalizeImageQuality('hd')).toBe('hd');
    expect(normalizeImageQuality(undefined)).toBeUndefined();

    expect(
      findLastGeneratedPrompt([
        { metadata: { messageType: 'image_result', prompt: 'first' } },
        { metadata: { messageType: 'markdown', prompt: 'ignored' } },
        { metadata: { messageType: 'image_result', prompt: 'latest' } },
      ]),
    ).toBe('latest');
  });

  it('builds resolved request basics from normalized request state', () => {
    expect(resolveImageRequestMode({})).toBe('generate');
    expect(resolveImageRequestMode({ sourceImages: [] })).toBe('generate');
    expect(
      resolveImageRequestMode({
        sourceImages: [{ url: 'https://img.test/source.png' }],
      }),
    ).toBe('edit');

    expect(normalizePromptOverride(undefined)).toBeUndefined();
    expect(normalizePromptOverride('   ')).toBeUndefined();
    expect(normalizePromptOverride('  polished prompt  ')).toBe('polished prompt');

    expect(
      buildResolvedImageRequest({
        mode: 'edit',
        prompt: 'polished prompt',
        modelConfig: {
          id: 'image-model-1',
          model: 'gpt-image-2',
        },
        template: { title: 'Template' },
        variables: { product: 'phone' },
        sourceImages: [{ url: 'https://img.test/source.png' }],
        referenceImages: [{ url: 'https://img.test/ref.png' }],
        settings: { quality: 'high' },
      }),
    ).toEqual({
      mode: 'edit',
      prompt: 'polished prompt',
      modelConfig: {
        id: 'image-model-1',
        model: 'gpt-image-2',
      },
      template: { title: 'Template' },
      variables: { product: 'phone' },
      sourceImages: [{ url: 'https://img.test/source.png' }],
      referenceImages: [{ url: 'https://img.test/ref.png' }],
      settings: { quality: 'high' },
    });
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

  it('builds workbench prompt refinement plan and result shape', () => {
    const plan = buildRefineWorkbenchPromptPlan({
      prompt: 'phone poster',
      settings: {
        stylePreset: '产品海报',
        promptTuning: '电商卖点',
        negativePrompt: '低清晰度',
      },
      imageModel: {
        model: 'gpt-image-2',
        provider: 'openai-official',
      },
    });

    expect(plan.kind).toBe('gpt-image');
    expect(plan.composedPrompt).toContain('phone poster');
    expect(plan.composedPrompt).toContain('style direction: 产品海报');
    expect(plan.additions).toContain('prompt tuning: 电商卖点');
    expect(plan.tuningSettings).toEqual({
      stylePreset: '产品海报',
      promptTuning: '电商卖点',
      negativePrompt: '低清晰度',
      imageModelKind: 'gpt-image',
      imageModelName: 'gpt-image-2',
    });

    expect(
      buildRefineWorkbenchPromptResult({
        originalPrompt: 'phone poster',
        composedPrompt: plan.composedPrompt,
        refinedPrompt: 'refined phone poster',
        imageModel: { model: 'gpt-image-2' },
        chatModel: { model: 'gpt-4o-mini' },
        additions: plan.additions,
      }),
    ).toEqual({
      originalPrompt: 'phone poster',
      composedPrompt: plan.composedPrompt,
      refinedPrompt: 'refined phone poster',
      model: 'gpt-image-2',
      chatModel: 'gpt-4o-mini',
      additions: plan.additions,
    });
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
      modelConfigId: 'chat-1',
      params: {},
      usage: { inputTokens: 120, outputTokens: 80 },
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
    expect(
      buildPromptOptimizeHoldCreateInput({
        taskType: 'prompt_optimize_generation',
        taskId: 'prompt-optimize:user-1:1:abc',
        estimate: {
          estimatedCost: 25,
          pricingSnapshot: { ruleId: 'rule-1' },
        },
        mode: 'edit',
        prompt: 'edit prompt',
        sourceImages: [{ url: 'https://img.test/source.png' }],
        referenceImages: [{ url: 'https://img.test/ref.png' }],
        config,
        tokens,
      }),
    ).toEqual({
      taskType: 'prompt_optimize_generation',
      taskId: 'prompt-optimize:user-1:1:abc',
      amount: 25,
      pricingSnapshot: { ruleId: 'rule-1' },
      metadata: {
        mode: 'edit',
        promptLength: 11,
        modelConfigId: 'chat-1',
        modelName: 'gpt-4o-mini',
        inputTokens: 120,
        estimatedOutputTokens: 80,
        referenceImages: 2,
      },
      remark: '图片工作台 Prompt AI 优化 · openai-official/gpt-4o-mini',
    });
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

    // quantity 不再进计价 params —— schema 不声明它，也没有任何计价 term 引用它。
    // resolution 也不在这里：它由服务端 estimator 的 deriveParams 从 size 派生（spec §6.2），
    // 这里只把用户参数原样透传 + 注入真实 referenceImages 张数。
    expect(buildImageGenerationEstimateInput(request)).toEqual({
      taskType: 'image_generation',
      modelConfigId: 'image-model-1',
      params: {
        quality: 'hd',
        size: '1024x1024',
        referenceImages: 1,
      },
    });
    expect(buildImageGenerationEstimateInput(request, 2)).toMatchObject({
      taskType: 'image_generation',
      membershipLevel: 2,
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
    expect(buildImageGenerationHoldRemark('image_generation')).toBe('image-generation');
    expect(
      buildImageGenerationHoldCreateInput({
        taskId: 'image:user-1:1:abc',
        estimate: {
          taskType: 'image_generation',
          estimatedCost: 90,
          pricingSnapshot: { ruleId: 'image-rule-1' },
        },
        // 冻结额 = 单张估价(90) × 张数(3) = 270（张数由业务逻辑计费，pricingSchema 只算单张）。
        count: 3,
        requestInput: {
          templateId: 'tpl-1',
          modelConfigId: 'image-model-1',
          conversationId: 'conv-1',
        },
        request,
      }),
    ).toEqual({
      taskType: 'image_generation',
      taskId: 'image:user-1:1:abc',
      amount: 270,
      pricingSnapshot: { ruleId: 'image-rule-1' },
      metadata: {
        templateId: 'tpl-1',
        modelConfigId: 'image-model-1',
        conversationId: 'conv-1',
        mode: 'generate',
        prompt: 'A scene',
      },
      remark: 'image-generation',
    });
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

  it('builds completed image generation repository input', () => {
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
    const images = ['https://cdn.test/1.png'];
    const input = buildCompletedImageGenerationRepositoryInput({
      requestInput: {
        templateId: 'tpl-1',
        userId: 'user-1',
        modelConfigId: 'image-model-1',
        chatModelId: 'chat-1',
        conversationId: 'conv-1',
      },
      request,
      images,
      durationMs: 1234,
      sourceImages,
      referenceImages,
    });

    expect(input).toMatchObject({
      templateId: 'tpl-1',
      userId: 'user-1',
      modelUsed: 'gpt-image-2',
      resolvedPrompt: 'refined prompt',
      variables: {
        style: 'modern',
        __workbench: {
          mode: 'edit',
          sourceImages,
          referenceImages,
          settings: { quality: 'medium' },
          modelConfigId: 'image-model-1',
          chatModelId: 'chat-1',
        },
      },
      referenceImage: 'https://cdn.test/source.png',
      generatedImages: images,
      durationMs: 1234,
      conversationId: 'conv-1',
      conversationContent: '![](https://cdn.test/1.png)',
    });

    const imageItems = input.buildImageItems('gen-1');
    expect(imageItems).toEqual([
      {
        url: 'https://cdn.test/1.png',
        index: 0,
        generationId: 'gen-1',
        prompt: 'refined prompt',
        sourceImages,
        referenceImages,
      },
    ]);
    expect(input.buildMessageMetadata('gen-1', imageItems)).toEqual({
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
  });

  it('validates prompt model capabilities and builds human message content', () => {
    expect(supportsImagePromptChatModel({ capabilities: null })).toBe(true);
    expect(supportsImagePromptChatModel({ capabilities: [] })).toBe(true);
    expect(supportsImagePromptChatModel({ capabilities: ['image'] })).toBe(false);
    expect(supportsImagePromptChatModel({ capabilities: ['reasoning'] })).toBe(true);

    expect(supportsImagePromptVision({ capabilities: [] })).toBe(true);
    expect(supportsImagePromptVision({ capabilities: ['text'] })).toBe(false);
    expect(supportsImagePromptVision({ capabilities: ['text', 'vision'] })).toBe(true);

    expect(buildWorkbenchHumanMessageContent('plain prompt', [])).toBe(
      'plain prompt',
    );
    expect(
      buildWorkbenchHumanMessageContent('prompt with images', [
        'https://img.test/source.png',
        'data:image/png;base64,abc123',
      ]),
    ).toEqual([
      { type: 'text', text: 'prompt with images' },
      {
        type: 'image_url',
        image_url: { url: 'https://img.test/source.png' },
      },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' },
      },
    ]);
  });

  it('normalizes generation result metadata without service state', () => {
    expect(normalizeImageGenerationCount(0)).toBe(1);
    expect(normalizeImageGenerationCount(3)).toBe(3);
    expect(normalizeImageGenerationCount(9)).toBe(4);

    const request: ResolvedImageRequest = {
      mode: 'generate',
      prompt: 'A scene',
      modelConfig: {
        id: 'image-model-1',
        model: 'custom-image',
        createdBy: 'user-1',
      },
      template: {},
      variables: {},
    };
    expect(resolvePersistedGenerationId({ id: 'gen-1' }, 'fallback')).toBe('gen-1');
    expect(resolvePersistedGenerationId({ id: 123 }, 'fallback')).toBe('fallback');

    expect(
      buildImageGenerationSuccessResult({
        persisted: {
          generation: { id: 'gen-1' },
          images: [
            {
              url: 'https://img.test/1.png',
              index: 0,
              generationId: 'gen-1',
              prompt: 'A scene',
            },
          ],
        },
        appliedSettings: {
          size: '1024x1024',
          quality: 'medium',
          count: 1,
          coerced: false,
          notes: [],
          kind: 'gpt-image',
        },
        request,
      }),
    ).toEqual({
      generation: { id: 'gen-1' },
      images: [
        {
          url: 'https://img.test/1.png',
          index: 0,
          generationId: 'gen-1',
          prompt: 'A scene',
        },
      ],
      appliedSettings: {
        size: '1024x1024',
        quality: 'medium',
        count: 1,
        coerced: false,
        notes: [],
        kind: 'gpt-image',
      },
      prompt: 'A scene',
      model: 'custom-image',
    });
  });

  it('formats upload failure log details without logging from helpers', () => {
    expect(
      getUploadFailureLogDetails({
        image: 'data:image/png;base64,abcdefghijklmnopqrstuvwxyz',
        index: 2,
        reason: new Error('upload failed'),
      }),
    ).toEqual({
      index: 2,
      sizeHint: 48,
      preview: 'data:image/png;base64,abcdefghij',
      reason: 'Error: upload failed',
    });
    expect(
      getUploadFailureLogDetails({
        image: null,
        index: 0,
        reason: 'bad image',
      }),
    ).toEqual({
      index: 0,
      sizeHint: 0,
      preview: '',
      reason: 'bad image',
    });
  });
});

describe('shouldTuneWorkbenchPrompt', () => {
  it('returns false for the faithful token the frontend actually sends', () => {
    // 前端发的是 PROMPT_TUNING_VALUES 里的 'faithful'（英文 token），不是中文 UI 文案。
    // 选了 faithful 就不该再调一次 prompt-optimize LLM，否则多扣一笔钱。
    expect(shouldTuneWorkbenchPrompt({ promptTuning: 'faithful' })).toBe(false);
  });

  it('returns true for a real tuning mode', () => {
    expect(shouldTuneWorkbenchPrompt({ promptTuning: 'photoDetail' })).toBe(true);
    expect(shouldTuneWorkbenchPrompt({ promptTuning: 'auto' })).toBe(true);
  });

  it('returns false when skipPromptTuning is set', () => {
    expect(
      shouldTuneWorkbenchPrompt({ promptTuning: 'photoDetail', skipPromptTuning: true }),
    ).toBe(false);
  });

  it('returns false when promptTuning is absent', () => {
    expect(shouldTuneWorkbenchPrompt({})).toBe(false);
    expect(shouldTuneWorkbenchPrompt(undefined)).toBe(false);
  });

  it('no longer treats the legacy Chinese literal as the neutral value', () => {
    // 变异测试：旧实现判 `!== '忠实原文'`，对前端发的每一个 token 都恒为真。
    // '忠实原文' 不在 PROMPT_TUNING_VALUES 里，是非法值，仍应视为「要调优」——
    // 但它绝不能是唯一被豁免的值。
    expect(shouldTuneWorkbenchPrompt({ promptTuning: '忠实原文' })).toBe(true);
  });
});
