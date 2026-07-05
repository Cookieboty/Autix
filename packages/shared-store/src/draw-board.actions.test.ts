import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  appendConversationMessage: vi.fn(),
  canvasBoardApi: {
    list: vi.fn(),
    create: vi.fn(),
    getState: vi.fn(),
    saveStateWithVersion: vi.fn(),
    update: vi.fn(),
    chatGenerate: vi.fn(),
  },
  createConversation: vi.fn(),
  getAvailableModels: vi.fn(),
  getConversationMessages: vi.fn(),
  getConversations: vi.fn(),
  pointsApi: {
    getBalance: vi.fn(),
  },
  updateConversationTitle: vi.fn(),
  uploadToPresignedUrl: vi.fn(),
  videoProjectApi: {
    create: vi.fn(),
    addClip: vi.fn(),
    addMaterial: vi.fn(),
    deleteClip: vi.fn(),
    generateClip: vi.fn(),
    generateAll: vi.fn(),
    getById: vi.fn(),
    optimizePrompt: vi.fn(),
    uploadUrl: vi.fn(),
    refreshGeneration: vi.fn(),
    getGenerations: vi.fn(),
  },
}));

vi.mock('@autix/sdk', () => ({
  appendConversationMessage: sdkMocks.appendConversationMessage,
  canvasBoardApi: sdkMocks.canvasBoardApi,
  createConversation: sdkMocks.createConversation,
  getAvailableModels: sdkMocks.getAvailableModels,
  getConversationMessages: sdkMocks.getConversationMessages,
  getConversations: sdkMocks.getConversations,
  pointsApi: sdkMocks.pointsApi,
  updateConversationTitle: sdkMocks.updateConversationTitle,
  uploadToPresignedUrl: sdkMocks.uploadToPresignedUrl,
  videoProjectApi: sdkMocks.videoProjectApi,
}));

describe('drawBoardActions video composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let clipIndex = 0;
    sdkMocks.videoProjectApi.addClip.mockImplementation(async () => ({
      data: { id: `clip-${++clipIndex}` },
    }));
    sdkMocks.videoProjectApi.addMaterial.mockResolvedValue({ data: { id: 'material-1' } });
    sdkMocks.videoProjectApi.deleteClip.mockResolvedValue({ data: {} });
    sdkMocks.videoProjectApi.generateClip.mockResolvedValue({
      data: { generationId: 'generation-1', taskId: 'task-1' },
    });
    sdkMocks.videoProjectApi.generateAll.mockResolvedValue({
      data: [{ generationId: 'story-generation-1', taskId: 'task-story', clipId: 'clip-1' }],
    });
    sdkMocks.videoProjectApi.optimizePrompt.mockResolvedValue({
      data: { optimizedPrompt: '优化后的镜头提示词' },
    });
    sdkMocks.videoProjectApi.uploadUrl.mockResolvedValue({
      data: {
        uploadUrl: 'https://upload.example.com/presigned',
        publicUrl: 'https://cdn.example.com/uploaded.png',
        key: 'draw-video/uploaded.png',
      },
    });
    sdkMocks.videoProjectApi.getById.mockResolvedValue({ data: { id: 'project-1', clips: [] } });
    sdkMocks.uploadToPresignedUrl.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts reference mode as one clip with reference_image materials', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');

    const result = await drawBoardActions.startVideoComposition('project-1', {
      mode: 'reference',
      prompt: '保持角色一致',
      referenceUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
      shots: [],
      params: { modelConfigId: 'model-video' },
    });

    expect(result).toEqual({ projectId: 'project-1', generationId: 'generation-1' });
    expect(sdkMocks.videoProjectApi.addClip).toHaveBeenCalledWith('project-1', {
      prompt: '保持角色一致',
      params: expect.objectContaining({
        modelConfigId: 'model-video',
        generationMode: 'standard',
      }),
      chainFromPrev: false,
    });
    expect(sdkMocks.videoProjectApi.addMaterial).toHaveBeenCalledTimes(2);
    expect(sdkMocks.videoProjectApi.addMaterial).toHaveBeenNthCalledWith(1, 'project-1', 'clip-1', {
      role: 'reference_image',
      sourceType: 'image_generation',
      url: 'https://example.com/a.png',
    });
    expect(sdkMocks.videoProjectApi.generateClip).toHaveBeenCalledWith('project-1', 'clip-1');
  });

  it('reuses an existing node video project when it can be loaded', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');
    sdkMocks.videoProjectApi.getById.mockResolvedValue({ data: { id: 'project-existing' } });

    const result = await drawBoardActions.ensureVideoProjectForNode({
      projectId: 'project-existing',
      title: '画布视频',
    });

    expect(result).toEqual({ projectId: 'project-existing' });
    expect(sdkMocks.videoProjectApi.create).not.toHaveBeenCalled();
  });

  it('creates a standalone project when the mapped project is genuinely gone (404)', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');
    sdkMocks.videoProjectApi.getById.mockRejectedValue({ response: { status: 404 } });
    sdkMocks.videoProjectApi.create.mockResolvedValue({ data: { id: 'project-new' } });

    const result = await drawBoardActions.ensureVideoProjectForNode({
      projectId: 'project-old',
      title: '节点视频',
    });

    expect(result).toEqual({ projectId: 'project-new' });
    expect(sdkMocks.videoProjectApi.create).toHaveBeenCalledWith({
      title: '节点视频',
      standalone: true,
    });
  });

  it('does NOT recreate the project on a transient (non-404) error — avoids orphaning it', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');
    sdkMocks.videoProjectApi.getById.mockRejectedValue({ response: { status: 500 } });
    sdkMocks.videoProjectApi.create.mockResolvedValue({ data: { id: 'project-new' } });

    await expect(
      drawBoardActions.ensureVideoProjectForNode({ projectId: 'project-old', title: '节点视频' }),
    ).rejects.toBeDefined();
    expect(sdkMocks.videoProjectApi.create).not.toHaveBeenCalled();
  });

  it('optimizes a draw video prompt through the video project API', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');

    const result = await drawBoardActions.optimizeVideoPrompt({
      prompt: '镜头向前推进',
      modelId: 'model-text',
    });

    expect(result).toBe('优化后的镜头提示词');
    expect(sdkMocks.videoProjectApi.optimizePrompt).toHaveBeenCalledWith({
      prompt: '镜头向前推进',
      modelId: 'model-text',
    });
  });

  it('starts first_last_frame mode with first and last frame materials', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');

    await drawBoardActions.startVideoComposition('project-1', {
      mode: 'first_last_frame',
      prompt: '从 A 到 B',
      firstFrameUrl: 'https://example.com/a.png',
      lastFrameUrl: 'https://example.com/b.png',
      referenceUrls: [],
      shots: [],
      params: { modelConfigId: 'model-video' },
    });

    expect(sdkMocks.videoProjectApi.addMaterial).toHaveBeenNthCalledWith(1, 'project-1', 'clip-1', {
      role: 'first_frame',
      sourceType: 'image_generation',
      url: 'https://example.com/a.png',
    });
    expect(sdkMocks.videoProjectApi.addMaterial).toHaveBeenNthCalledWith(2, 'project-1', 'clip-1', {
      role: 'last_frame',
      sourceType: 'image_generation',
      url: 'https://example.com/b.png',
    });
  });

  it('starts storyboard mode as chained clips and one generateAll task', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');

    const result = await drawBoardActions.startVideoComposition('project-1', {
      mode: 'storyboard',
      prompt: '统一电影感',
      referenceUrls: [],
      shots: [
        { prompt: '奔跑', firstFrameUrl: 'https://example.com/a.png', lastFrameUrl: 'https://example.com/b.png' },
        { prompt: '跳跃', firstFrameUrl: 'https://example.com/b.png', lastFrameUrl: 'https://example.com/c.png' },
      ],
      params: { modelConfigId: 'model-video', duration: 4 },
    });

    expect(result.generationId).toBe('story-generation-1');
    expect(sdkMocks.videoProjectApi.addClip).toHaveBeenNthCalledWith(1, 'project-1', {
      title: '镜头 1',
      prompt: '奔跑',
      params: expect.objectContaining({
        modelConfigId: 'model-video',
        generationMode: 'storyboard',
        storyboardPrompt: '统一电影感',
        duration: 4,
      }),
      chainFromPrev: false,
    });
    expect(sdkMocks.videoProjectApi.addClip).toHaveBeenNthCalledWith(2, 'project-1', {
      title: '镜头 2',
      prompt: '跳跃',
      params: expect.objectContaining({
        modelConfigId: 'model-video',
        generationMode: 'storyboard',
        storyboardPrompt: '统一电影感',
        duration: 4,
      }),
      chainFromPrev: true,
    });
    expect(sdkMocks.videoProjectApi.generateAll).toHaveBeenCalledWith('project-1');
    expect(sdkMocks.videoProjectApi.generateClip).not.toHaveBeenCalled();
  });

  it('replaces existing project clips before starting a canvas composition', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');
    sdkMocks.videoProjectApi.getById.mockResolvedValueOnce({
      data: {
        id: 'project-1',
        clips: [{ id: 'old-1' }, { id: 'old-2' }],
      },
    });

    await drawBoardActions.startVideoComposition('project-1', {
      mode: 'storyboard',
      prompt: '统一电影感',
      referenceUrls: [],
      shots: [
        { prompt: '奔跑', firstFrameUrl: 'https://example.com/a.png', lastFrameUrl: 'https://example.com/b.png' },
      ],
      params: { modelConfigId: 'model-video' },
    });

    expect(sdkMocks.videoProjectApi.deleteClip).toHaveBeenNthCalledWith(1, 'project-1', 'old-1');
    expect(sdkMocks.videoProjectApi.deleteClip).toHaveBeenNthCalledWith(2, 'project-1', 'old-2');
    expect(sdkMocks.videoProjectApi.addClip.mock.invocationCallOrder[0]).toBeGreaterThan(
      sdkMocks.videoProjectApi.deleteClip.mock.invocationCallOrder[1],
    );
    expect(sdkMocks.videoProjectApi.generateAll).toHaveBeenCalledTimes(1);
  });

  it('uploads data URLs before adding them as materials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      blob: async () => new Blob(['image'], { type: 'image/png' }),
    })));
    const { drawBoardActions } = await import('./draw-board.actions');
    const dataUrl = 'data:image/png;base64,aW1hZ2U=';

    await drawBoardActions.startVideoComposition('project-1', {
      mode: 'image_to_video',
      prompt: '动起来',
      firstFrameUrl: dataUrl,
      referenceUrls: [],
      shots: [],
      params: { modelConfigId: 'model-video' },
    });

    expect(sdkMocks.videoProjectApi.uploadUrl).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'image/png',
      folder: 'amux-studio/draw-video-inputs',
    }));
    expect(sdkMocks.uploadToPresignedUrl).toHaveBeenCalled();
    expect(sdkMocks.videoProjectApi.addMaterial).toHaveBeenCalledWith('project-1', 'clip-1', {
      role: 'first_frame',
      sourceType: 'upload',
      url: 'https://cdn.example.com/uploaded.png',
    });
  });

  it('does not call video API when composition has blocking issues', async () => {
    const { drawBoardActions } = await import('./draw-board.actions');

    await expect(drawBoardActions.startVideoComposition('project-1', {
      mode: 'text_to_video',
      prompt: '',
      referenceUrls: [],
      shots: [],
      issues: [{ level: 'blocking', code: 'empty-prompt', message: '需要 prompt' }],
      params: { modelConfigId: 'model-video' },
    })).rejects.toThrow('需要 prompt');

    expect(sdkMocks.videoProjectApi.addClip).not.toHaveBeenCalled();
    expect(sdkMocks.videoProjectApi.generateClip).not.toHaveBeenCalled();
    expect(sdkMocks.videoProjectApi.generateAll).not.toHaveBeenCalled();
  });
});
