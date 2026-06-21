import { beforeEach, describe, expect, it, vi } from 'vitest';

const videoProjectApiMock = vi.hoisted(() => ({
  getWorkbenchDefault: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  addClip: vi.fn(),
  updateClip: vi.fn(),
  deleteClip: vi.fn(),
  addMaterial: vi.fn(),
  removeMaterial: vi.fn(),
  generateClip: vi.fn(),
  generateAll: vi.fn(),
  getGenerations: vi.fn(),
  refreshGeneration: vi.fn(),
}));

vi.mock('@autix/sdk', () => ({
  videoProjectApi: videoProjectApiMock,
}));

function apiCallCount() {
  return Object.values(videoProjectApiMock).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
}

describe('useVideoProjectStore local drafts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useVideoProjectStore } = await import('./video-project.store');
    useVideoProjectStore.setState({
      project: null,
      projects: [],
      selectedClipId: null,
      generatingClipIds: [],
      loading: false,
      lastError: null,
    });
  });

  it('keeps the current local draft without asking the server', async () => {
    const { useVideoProjectStore } = await import('./video-project.store');
    const localDraft = await useVideoProjectStore.getState().loadOrCreateStandaloneProject();
    vi.clearAllMocks();

    const project = await useVideoProjectStore.getState().loadOrCreateStandaloneProject();

    expect(project.id).toBe(localDraft.id);
    expect(apiCallCount()).toBe(0);
  });

  it('opens the latest storyboard-only project when there is no local draft', async () => {
    const { useVideoProjectStore } = await import('./video-project.store');
    videoProjectApiMock.getWorkbenchDefault.mockResolvedValue({
      data: {
        id: 'server-storyboard-project-1',
        userId: 'user-1',
        title: '最近分镜项目',
        conversationId: null,
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        clips: [
          {
            id: 'server-clip-1',
            projectId: 'server-storyboard-project-1',
            order: 1,
            title: '开场',
            prompt: '产品在晨光中缓慢转场',
            params: { duration: 5, ratio: '16:9' },
            chainFromPrev: false,
            status: 'pending',
            materials: [],
            generations: [],
          },
        ],
      },
    });

    const project = await useVideoProjectStore.getState().loadOrCreateStandaloneProject();

    expect(project.id).toBe('server-storyboard-project-1');
    expect(useVideoProjectStore.getState().selectedClipId).toBe('server-clip-1');
    expect(videoProjectApiMock.getWorkbenchDefault).toHaveBeenCalledTimes(1);
    expect(videoProjectApiMock.create).not.toHaveBeenCalled();
  });

  it('starts an empty local draft when there is no local draft or storyboard-only project', async () => {
    const { useVideoProjectStore } = await import('./video-project.store');
    videoProjectApiMock.getWorkbenchDefault.mockResolvedValue({ data: null });

    const project = await useVideoProjectStore.getState().loadOrCreateStandaloneProject();

    expect(project.id).toMatch(/^local-video-project-/);
    expect(project.clips).toHaveLength(0);
    expect(videoProjectApiMock.getWorkbenchDefault).toHaveBeenCalledTimes(1);
    expect(videoProjectApiMock.create).not.toHaveBeenCalled();
  });

  it('edits storyboard content locally without touching the video project API', async () => {
    const { useVideoProjectStore } = await import('./video-project.store');
    videoProjectApiMock.getWorkbenchDefault.mockResolvedValue({ data: null });
    await useVideoProjectStore.getState().loadOrCreateStandaloneProject();
    vi.clearAllMocks();

    await useVideoProjectStore.getState().addClip({
      title: '开场',
      prompt: '产品在晨光中缓慢转场',
      params: { duration: 5, ratio: '16:9' },
    });
    const clipId = useVideoProjectStore.getState().project?.clips[0]?.id;
    expect(clipId).toBeTruthy();

    await useVideoProjectStore.getState().updateClip(clipId!, {
      title: '开场镜头',
      prompt: '产品在晨光中推进',
    });
    await useVideoProjectStore.getState().updateClipParams(clipId!, { duration: 6 });
    await useVideoProjectStore.getState().addMaterial(clipId!, {
      role: 'first_frame',
      sourceType: 'upload',
      url: 'https://example.com/frame.png',
      name: '首帧',
    });
    const materialId = useVideoProjectStore.getState().project?.clips[0]?.materials[0]?.id;
    expect(materialId).toBeTruthy();
    await useVideoProjectStore.getState().removeMaterial(materialId!);

    const clip = useVideoProjectStore.getState().project?.clips[0];
    expect(clip?.title).toBe('开场镜头');
    expect(clip?.prompt).toBe('产品在晨光中推进');
    expect(clip?.params.duration).toBe(6);
    expect(clip?.materials).toHaveLength(0);
    expect(apiCallCount()).toBe(0);
  });

  it('persists the local draft only when generation is requested', async () => {
    const { useVideoProjectStore } = await import('./video-project.store');
    videoProjectApiMock.getWorkbenchDefault.mockResolvedValue({ data: null });
    await useVideoProjectStore.getState().loadOrCreateStandaloneProject();
    vi.clearAllMocks();
    await useVideoProjectStore.getState().addClip({
      title: '开场',
      prompt: '产品在晨光中缓慢转场',
      params: { duration: 5, ratio: '16:9' },
    });
    const localClipId = useVideoProjectStore.getState().project?.clips[0]?.id;
    videoProjectApiMock.create.mockResolvedValue({
      data: {
        id: 'server-project-1',
        userId: 'user-1',
        title: '专业视频工作台',
        conversationId: null,
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        clips: [],
      },
    });
    videoProjectApiMock.addClip.mockResolvedValue({
      data: {
        id: 'server-clip-1',
        projectId: 'server-project-1',
        order: 1,
        title: '开场',
        prompt: '产品在晨光中缓慢转场',
        params: { duration: 5, ratio: '16:9' },
        chainFromPrev: false,
        status: 'pending',
        materials: [],
        generations: [],
      },
    });
    videoProjectApiMock.getById.mockResolvedValue({
      data: {
        id: 'server-project-1',
        userId: 'user-1',
        title: '专业视频工作台',
        conversationId: null,
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        clips: [
          {
            id: 'server-clip-1',
            projectId: 'server-project-1',
            order: 1,
            title: '开场',
            prompt: '产品在晨光中缓慢转场',
            params: { duration: 5, ratio: '16:9' },
            chainFromPrev: false,
            status: 'pending',
            materials: [],
            generations: [],
          },
        ],
      },
    });
    videoProjectApiMock.list.mockResolvedValue({ data: { items: [] } });
    videoProjectApiMock.generateAll.mockResolvedValue({
      data: [{ generationId: 'generation-1', taskId: 'task-1', clipId: 'server-clip-1' }],
    });

    await useVideoProjectStore.getState().generateClip(localClipId!);

    expect(videoProjectApiMock.create).toHaveBeenCalledWith({
      title: '专业视频工作台',
      coverImage: undefined,
      standalone: true,
    });
    expect(videoProjectApiMock.addClip).toHaveBeenCalledWith('server-project-1', {
      title: '开场',
      prompt: '产品在晨光中缓慢转场',
      params: { duration: 5, ratio: '16:9' },
      chainFromPrev: false,
    });
    expect(videoProjectApiMock.generateClip).not.toHaveBeenCalled();
    expect(videoProjectApiMock.generateAll).toHaveBeenCalledWith('server-project-1');
  });
});
