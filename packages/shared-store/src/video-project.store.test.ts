import { beforeEach, describe, expect, it, vi } from 'vitest';

const videoProjectApiMock = vi.hoisted(() => ({
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

  it('edits storyboard content locally without touching the video project API', async () => {
    const { useVideoProjectStore, createLocalVideoProject } = await import('./video-project.store');
    useVideoProjectStore.getState().replaceDraftProject(createLocalVideoProject(''));
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
    const { useVideoProjectStore, createLocalVideoProject } = await import('./video-project.store');
    useVideoProjectStore.getState().replaceDraftProject(createLocalVideoProject(''));
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
        title: '',
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
        title: '',
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
    videoProjectApiMock.refreshGeneration.mockResolvedValue({
      data: {
        id: 'generation-1',
        clipId: 'server-clip-1',
        status: 'completed',
        resultUrl: 'https://example.com/video.mp4',
      },
    });

    vi.useFakeTimers();
    const generatePromise = useVideoProjectStore.getState().generateClip(localClipId!);
    await vi.advanceTimersByTimeAsync(4000);
    await generatePromise;
    vi.useRealTimers();

    expect(videoProjectApiMock.create).toHaveBeenCalledWith({
      title: '',
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
