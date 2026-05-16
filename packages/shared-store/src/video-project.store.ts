import { create } from 'zustand';
import { videoProjectApi } from '@autix/shared-lib';

export interface VideoClipMaterial {
  id: string;
  clipId: string;
  role: string;
  sourceType: string;
  sourceId?: string | null;
  url: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VideoClipGeneration {
  id: string;
  clipId: string;
  projectId: string;
  userId: string;
  variantLabel?: string | null;
  model: string;
  resolvedPrompt: string;
  params: Record<string, unknown>;
  seedanceTaskId?: string | null;
  status: string;
  videoUrl?: string | null;
  lastFrameUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  error?: string | null;
  externalStatus?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface VideoClip {
  id: string;
  projectId: string;
  order: number;
  title?: string | null;
  prompt?: string | null;
  params: Record<string, unknown>;
  chainFromPrev: boolean;
  status: string;
  materials: VideoClipMaterial[];
  generations: VideoClipGeneration[];
}

export interface VideoProject {
  id: string;
  userId: string;
  title: string;
  conversationId?: string | null;
  coverImage?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  clips: VideoClip[];
}

interface VideoProjectState {
  project: VideoProject | null;
  projects: VideoProject[];
  selectedClipId: string | null;
  generatingClipIds: string[];
  loading: boolean;
  lastError: string | null;

  loadProject: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  createProject: (title: string) => Promise<VideoProject>;
  setProject: (project: VideoProject | null) => void;
  selectClip: (clipId: string | null) => void;
  clearError: () => void;

  addClip: (data: { title?: string; prompt?: string; params: Record<string, unknown>; chainFromPrev?: boolean }) => Promise<void>;
  updateClip: (clipId: string, data: { title?: string; prompt?: string; params?: Record<string, unknown>; chainFromPrev?: boolean }) => Promise<void>;
  updateClipParams: (clipId: string, partial: Record<string, unknown>) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;

  addMaterial: (clipId: string, data: { role: string; sourceType: string; sourceId?: string; url: string; name?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  removeMaterial: (materialId: string) => Promise<void>;

  generateClip: (clipId: string, variantLabel?: string) => Promise<void>;
  generateAll: () => Promise<void>;

  createFromTemplate: (templateId: string, variables?: Record<string, string>) => Promise<void>;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'expired']);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 2 * 60_000;

function extractErrorMessage(err: unknown): string {
  if (!err) return '未知错误';
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
    const respMsg = anyErr.response?.data?.message;
    if (Array.isArray(respMsg)) return respMsg.join('; ');
    if (typeof respMsg === 'string' && respMsg.length > 0) return respMsg;
    if (typeof anyErr.message === 'string') return anyErr.message;
  }
  return String(err);
}

async function pollGenerationUntilTerminal(
  projectId: string,
  generationId: string,
  onTick: (g: VideoClipGeneration) => void,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let list: VideoClipGeneration[] = [];
    try {
      const res = await videoProjectApi.getGenerations(projectId);
      list = (res.data ?? []) as unknown as VideoClipGeneration[];
    } catch {
      continue;
    }
    const hit = list.find((x) => x.id === generationId);
    if (!hit) continue;
    onTick(hit);
    if (TERMINAL_STATUSES.has(hit.status)) return;
  }
}

// Plan-5: generateAll 触发多个 head generation，需要等"全部触发到的 generation 终态"才停止轮询
async function pollGenerationsUntilAllTerminal(
  projectId: string,
  generationIds: string[],
  onTick: (g: VideoClipGeneration) => void,
): Promise<void> {
  if (generationIds.length === 0) return;
  const tracking = new Set(generationIds);
  const terminal = new Set<string>();
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS && terminal.size < tracking.size) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let list: VideoClipGeneration[] = [];
    try {
      const res = await videoProjectApi.getGenerations(projectId);
      list = (res.data ?? []) as unknown as VideoClipGeneration[];
    } catch {
      continue;
    }
    for (const g of list) {
      if (!tracking.has(g.id)) continue;
      onTick(g);
      if (TERMINAL_STATUSES.has(g.status)) terminal.add(g.id);
    }
  }
}

function mergeGeneration(
  set: (partial: Partial<VideoProjectState> | ((s: VideoProjectState) => Partial<VideoProjectState>)) => void,
  get: () => VideoProjectState,
  g: VideoClipGeneration,
): void {
  const cur = get().project;
  if (!cur) return;
  const nextClips = cur.clips.map((c) => {
    if (c.id !== g.clipId) return c;
    const idx = c.generations.findIndex((x) => x.id === g.id);
    const generations =
      idx >= 0
        ? c.generations.map((x, i) => (i === idx ? { ...x, ...g } : x))
        : [g, ...c.generations];
    return { ...c, generations };
  });
  set({ project: { ...cur, clips: nextClips } });
}

export const useVideoProjectStore = create<VideoProjectState>((set, get) => ({
  project: null,
  projects: [],
  selectedClipId: null,
  generatingClipIds: [],
  loading: false,
  lastError: null,

  clearError: () => set({ lastError: null }),

  loadProject: async (id) => {
    set({ loading: true });
    try {
      const res = await videoProjectApi.getById(id);
      const project = res.data as VideoProject;
      set({
        project,
        selectedClipId: project.clips[0]?.id ?? null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadProjects: async () => {
    try {
      const res = await videoProjectApi.list({ pageSize: 50 });
      const data = res.data as { items: VideoProject[] };
      set({ projects: data.items ?? [] });
    } catch { /* ignore */ }
  },

  createProject: async (title) => {
    const res = await videoProjectApi.create({ title });
    const project = res.data as VideoProject;
    set({ project, selectedClipId: null });
    get().loadProjects();
    return project;
  },

  setProject: (project) => set({ project, selectedClipId: project?.clips[0]?.id ?? null }),

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  addClip: async (data) => {
    const { project } = get();
    if (!project) return;
    await videoProjectApi.addClip(project.id, data);
    await get().loadProject(project.id);
  },

  updateClip: async (clipId, data) => {
    const { project } = get();
    if (!project) return;
    await videoProjectApi.updateClip(project.id, clipId, data);
    await get().loadProject(project.id);
  },

  updateClipParams: async (clipId, partial) => {
    const { project } = get();
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const nextParams = { ...(clip.params ?? {}), ...partial };
    await videoProjectApi.updateClip(project.id, clipId, { params: nextParams });
    await get().loadProject(project.id);
  },

  deleteClip: async (clipId) => {
    const { project } = get();
    if (!project) return;
    await videoProjectApi.deleteClip(project.id, clipId);
    await get().loadProject(project.id);
  },

  addMaterial: async (clipId, data) => {
    const { project } = get();
    if (!project) return;
    await videoProjectApi.addMaterial(project.id, clipId, data);
    await get().loadProject(project.id);
  },

  removeMaterial: async (materialId) => {
    const { project } = get();
    if (!project) return;
    await videoProjectApi.removeMaterial(project.id, materialId);
    await get().loadProject(project.id);
  },

  generateClip: async (clipId, variantLabel) => {
    const { project } = get();
    if (!project) return;
    set((s) => ({
      generatingClipIds: [...s.generatingClipIds, clipId],
      lastError: null,
    }));
    let generationId: string | null = null;
    try {
      const res = await videoProjectApi.generateClip(project.id, clipId, { variantLabel });
      generationId = res.data?.generationId ?? null;
    } catch (err) {
      set({ lastError: extractErrorMessage(err) });
      set((s) => ({ generatingClipIds: s.generatingClipIds.filter((id) => id !== clipId) }));
      return;
    }
    try {
      if (generationId) {
        await pollGenerationUntilTerminal(project.id, generationId, (g) => mergeGeneration(set, get, g));
      }
      await get().loadProject(project.id);
    } catch (err) {
      set({ lastError: extractErrorMessage(err) });
    } finally {
      set((s) => ({ generatingClipIds: s.generatingClipIds.filter((id) => id !== clipId) }));
    }
  },

  generateAll: async () => {
    const { project } = get();
    if (!project) return;
    // Plan-5: 后端只触发"pending head"，UI 上把所有非终态 clip 都置 generating，落到真实状态由轮询/loadProject 修正
    const trackingClipIds = project.clips
      .filter((c) => c.status === 'pending' || c.status === 'generating')
      .map((c) => c.id);
    set({ generatingClipIds: trackingClipIds, lastError: null });

    let triggered: Array<{ generationId: string; taskId: string; clipId: string }> = [];
    try {
      const res = await videoProjectApi.generateAll(project.id);
      triggered = (res.data ?? []) as Array<{ generationId: string; taskId: string; clipId: string }>;
    } catch (err) {
      set({ lastError: extractErrorMessage(err), generatingClipIds: [] });
      return;
    }
    try {
      const generationIds = triggered.map((t) => t.generationId);
      if (generationIds.length > 0) {
        await pollGenerationsUntilAllTerminal(project.id, generationIds, (g) =>
          mergeGeneration(set, get, g),
        );
      }
      await get().loadProject(project.id);
    } catch (err) {
      set({ lastError: extractErrorMessage(err) });
    } finally {
      set({ generatingClipIds: [] });
    }
  },

  createFromTemplate: async (templateId, variables) => {
    const res = await videoProjectApi.createFromTemplate(templateId, variables ? { variables } : undefined);
    const project = res.data as VideoProject;
    set({ project, selectedClipId: project.clips?.[0]?.id ?? null });
    get().loadProjects();
  },
}));
