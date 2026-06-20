import { create } from 'zustand';
import { videoProjectApi, type VideoWorkflowTemplate } from '@autix/sdk';

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
  workflowTemplates: VideoWorkflowTemplate[];
  selectedClipId: string | null;
  generatingClipIds: string[];
  loading: boolean;
  workflowTemplatesLoading: boolean;
  lastError: string | null;

  loadProject: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  loadWorkflowTemplates: (params?: { category?: string; page?: number; pageSize?: number }) => Promise<void>;
  loadOrCreateStandaloneProject: () => Promise<VideoProject>;
  replaceDraftProject: (project: VideoProject) => void;
  persistDraftProject: (options?: { withConversation?: boolean }) => Promise<{ project: VideoProject; clipIdMap: Record<string, string> }>;
  createProject: (title: string, conversationId?: string) => Promise<VideoProject>;
  deleteProject: (projectId: string) => Promise<void>;
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

  createFromTemplate: (templateId: string, variables?: Record<string, string>, conversationId?: string) => Promise<void>;
  applyWorkflowTemplate: (templateId: string, variables?: Record<string, string>) => Promise<void>;
  applyVideoTemplate: (templateId: string, variables?: Record<string, string>) => Promise<void>;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'expired']);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 2 * 60_000;
const LOCAL_PROJECT_PREFIX = 'local-video-project-';
const LOCAL_CLIP_PREFIX = 'local-video-clip-';
const LOCAL_MATERIAL_PREFIX = 'local-video-material-';

let localSeq = 0;

function nextLocalId(prefix: string) {
  localSeq += 1;
  return `${prefix}${Date.now()}-${localSeq}`;
}

function isLocalProject(project: VideoProject | null | undefined) {
  return Boolean(project?.id.startsWith(LOCAL_PROJECT_PREFIX));
}

function nowIso() {
  return new Date().toISOString();
}

export function createLocalVideoProject(
  title = '专业视频工作台',
  clips: Array<{
    title?: string;
    prompt?: string;
    params: Record<string, unknown>;
    chainFromPrev?: boolean;
  }> = [],
  coverImage?: string | null,
): VideoProject {
  const createdAt = nowIso();
  const id = nextLocalId(LOCAL_PROJECT_PREFIX);
  return {
    id,
    userId: 'local',
    title,
    conversationId: null,
    coverImage: coverImage ?? null,
    status: 'draft',
    createdAt,
    updatedAt: createdAt,
    clips: clips.map((clip, index) => createLocalClip(id, index + 1, clip)),
  };
}

function createLocalClip(
  projectId: string,
  order: number,
  data: { title?: string; prompt?: string; params: Record<string, unknown>; chainFromPrev?: boolean },
): VideoClip {
  return {
    id: nextLocalId(LOCAL_CLIP_PREFIX),
    projectId,
    order,
    title: data.title ?? `分镜 ${order}`,
    prompt: data.prompt ?? '',
    params: data.params,
    chainFromPrev: data.chainFromPrev ?? false,
    status: 'pending',
    materials: [],
    generations: [],
  };
}

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
    let hit: VideoClipGeneration | undefined;
    try {
      const res = await videoProjectApi.refreshGeneration(projectId, generationId);
      hit = res.data as unknown as VideoClipGeneration;
    } catch {
      try {
        const res = await videoProjectApi.getGenerations(projectId);
        const list = (res.data ?? []) as unknown as VideoClipGeneration[];
        hit = list.find((x) => x.id === generationId);
      } catch {
        continue;
      }
    }
    if (!hit) continue;
    onTick(hit);
    if (TERMINAL_STATUSES.has(hit.status)) return;
  }
}

// generateAll 触发多个 head generation，需要等"全部触发到的 generation 终态"才停止轮询
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
    const refreshed: VideoClipGeneration[] = [];
    for (const id of tracking) {
      if (terminal.has(id)) continue;
      try {
        const res = await videoProjectApi.refreshGeneration(projectId, id);
        refreshed.push(res.data as unknown as VideoClipGeneration);
      } catch {
        // Fall back to a single DB snapshot below when refresh is temporarily unavailable.
      }
    }
    if (refreshed.length > 0) {
      for (const g of refreshed) {
        if (!tracking.has(g.id)) continue;
        onTick(g);
        if (TERMINAL_STATUSES.has(g.status)) terminal.add(g.id);
      }
      continue;
    }

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
  workflowTemplates: [],
  selectedClipId: null,
  generatingClipIds: [],
  loading: false,
  workflowTemplatesLoading: false,
  lastError: null,

  clearError: () => set({ lastError: null }),

  loadProject: async (id) => {
    set({ loading: true });
    try {
      const res = await videoProjectApi.getById(id);
      const project = res.data as VideoProject;
      const selectedClipId = get().selectedClipId;
      const nextSelectedClipId = project.clips.some((clip) => clip.id === selectedClipId)
        ? selectedClipId
        : project.clips[0]?.id ?? null;
      set({
        project,
        selectedClipId: nextSelectedClipId,
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

  loadWorkflowTemplates: async (params) => {
    set({ workflowTemplatesLoading: true });
    try {
      const res = await videoProjectApi.listWorkflowTemplates(params);
      set({
        workflowTemplates: res.data?.items ?? [],
        workflowTemplatesLoading: false,
      });
    } catch {
      set({ workflowTemplates: [], workflowTemplatesLoading: false });
    }
  },

  loadOrCreateStandaloneProject: async () => {
    const existing = get().project;
    if (existing && isLocalProject(existing)) return existing;

    try {
      const res = await videoProjectApi.getWorkbenchDefault();
      const serverProject = res.data as VideoProject | null;
      if (serverProject?.id) {
        set({
          project: serverProject,
          selectedClipId: serverProject.clips?.[0]?.id ?? null,
          loading: false,
          lastError: null,
        });
        return serverProject;
      }
    } catch {
      // Server unavailable or no existing project — fall through to local draft
    }

    const project = createLocalVideoProject();
    set({
      project,
      selectedClipId: null,
      loading: false,
      lastError: null,
    });
    return project;
  },

  replaceDraftProject: (project) => {
    set({
      project,
      selectedClipId: project.clips[0]?.id ?? null,
      loading: false,
      lastError: null,
    });
  },

  persistDraftProject: async (options) => {
    const { project } = get();
    if (!project) throw new Error('没有可保存的视频草稿');
    if (!isLocalProject(project)) return { project, clipIdMap: {} };

    const created = await videoProjectApi.create({
      title: project.title,
      coverImage: project.coverImage ?? undefined,
      standalone: !options?.withConversation,
    });
    let serverProject = created.data as VideoProject;
    const clipIdMap: Record<string, string> = {};

    for (const clip of project.clips) {
      const res = await videoProjectApi.addClip(serverProject.id, {
        title: clip.title ?? undefined,
        prompt: clip.prompt ?? undefined,
        params: clip.params ?? {},
        chainFromPrev: clip.chainFromPrev,
      });
      const createdClip = res.data as VideoClip;
      clipIdMap[clip.id] = createdClip.id;

      for (const material of clip.materials) {
        await videoProjectApi.addMaterial(serverProject.id, createdClip.id, {
          role: material.role,
          sourceType: material.sourceType,
          sourceId: material.sourceId ?? undefined,
          url: material.url,
          name: material.name ?? undefined,
          metadata: material.metadata ?? undefined,
        });
      }
    }

    const fresh = await videoProjectApi.getById(serverProject.id);
    serverProject = fresh.data as VideoProject;
    const previousSelectedClipId = get().selectedClipId;
    set({
      project: serverProject,
      selectedClipId:
        (previousSelectedClipId ? clipIdMap[previousSelectedClipId] : null) ??
        serverProject.clips[0]?.id ??
        null,
    });
    get().loadProjects();
    return { project: serverProject, clipIdMap };
  },

  createProject: async (title, conversationId) => {
    const res = await videoProjectApi.create({ title, conversationId });
    const project = res.data as VideoProject;
    set({ project, selectedClipId: null });
    get().loadProjects();
    return project;
  },

  deleteProject: async (projectId) => {
    await videoProjectApi.remove(projectId);
    set((state) => ({
      projects: state.projects.filter((item) => item.id !== projectId),
      project: state.project?.id === projectId ? null : state.project,
      selectedClipId: state.project?.id === projectId ? null : state.selectedClipId,
    }));
  },

  setProject: (project) => set({ project, selectedClipId: project?.clips[0]?.id ?? null }),

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  addClip: async (data) => {
    const { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      const nextClip = createLocalClip(project.id, project.clips.length + 1, data);
      const nextProject = {
        ...project,
        clips: [...project.clips, nextClip],
        updatedAt: nowIso(),
      };
      set({ project: nextProject, selectedClipId: nextClip.id });
      return;
    }
    const res = await videoProjectApi.addClip(project.id, data);
    const nextClip = res.data as VideoClip;
    await get().loadProject(project.id);
    set({ selectedClipId: nextClip.id });
  },

  updateClip: async (clipId, data) => {
    const { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      set({
        project: {
          ...project,
          updatedAt: nowIso(),
          clips: project.clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            return {
              ...clip,
              ...(data.title !== undefined ? { title: data.title } : {}),
              ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
              ...(data.params !== undefined ? { params: data.params } : {}),
              ...(data.chainFromPrev !== undefined ? { chainFromPrev: data.chainFromPrev } : {}),
            };
          }),
        },
      });
      return;
    }
    await videoProjectApi.updateClip(project.id, clipId, data);
    await get().loadProject(project.id);
  },

  updateClipParams: async (clipId, partial) => {
    const { project } = get();
    if (!project) return;
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const nextParams = { ...(clip.params ?? {}), ...partial };
    if (isLocalProject(project)) {
      await get().updateClip(clipId, { params: nextParams });
      return;
    }
    await videoProjectApi.updateClip(project.id, clipId, { params: nextParams });
    await get().loadProject(project.id);
  },

  deleteClip: async (clipId) => {
    const { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      const clips = project.clips
        .filter((clip) => clip.id !== clipId)
        .map((clip, index) => ({ ...clip, order: index + 1 }));
      set({
        project: { ...project, clips, updatedAt: nowIso() },
        selectedClipId: clips[0]?.id ?? null,
      });
      return;
    }
    await videoProjectApi.deleteClip(project.id, clipId);
    await get().loadProject(project.id);
  },

  addMaterial: async (clipId, data) => {
    const { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      const material: VideoClipMaterial = {
        id: nextLocalId(LOCAL_MATERIAL_PREFIX),
        clipId,
        role: data.role,
        sourceType: data.sourceType,
        sourceId: data.sourceId ?? null,
        url: data.url,
        name: data.name ?? null,
        metadata: data.metadata ?? null,
      };
      set({
        project: {
          ...project,
          updatedAt: nowIso(),
          clips: project.clips.map((clip) =>
            clip.id === clipId
              ? { ...clip, materials: [...clip.materials.filter((item) => item.role !== data.role), material] }
              : clip,
          ),
        },
      });
      return;
    }
    await videoProjectApi.addMaterial(project.id, clipId, data);
    await get().loadProject(project.id);
  },

  removeMaterial: async (materialId) => {
    const { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      set({
        project: {
          ...project,
          updatedAt: nowIso(),
          clips: project.clips.map((clip) => ({
            ...clip,
            materials: clip.materials.filter((material) => material.id !== materialId),
          })),
        },
      });
      return;
    }
    await videoProjectApi.removeMaterial(project.id, materialId);
    await get().loadProject(project.id);
  },

  generateClip: async (clipId, variantLabel) => {
    let { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      const persisted = await get().persistDraftProject({ withConversation: false });
      project = persisted.project;
      clipId = persisted.clipIdMap[clipId] ?? clipId;
    }
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
    let { project } = get();
    if (!project) return;
    if (isLocalProject(project)) {
      const persisted = await get().persistDraftProject({ withConversation: false });
      project = persisted.project;
    }
    // 后端只触发"pending head"，UI 上把所有非终态 clip 都置 generating，落到真实状态由轮询/loadProject 修正
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

  createFromTemplate: async (templateId, variables, conversationId) => {
    const res = await videoProjectApi.createFromTemplate(templateId, {
      ...(variables ? { variables } : {}),
      ...(conversationId ? { conversationId } : {}),
    });
    const project = res.data as VideoProject;
    set({ project, selectedClipId: project.clips?.[0]?.id ?? null });
    get().loadProjects();
  },

  applyWorkflowTemplate: async (templateId, variables) => {
    const { project } = get();
    if (!project || isLocalProject(project)) return;
    set({ loading: true, lastError: null });
    try {
      const res = await videoProjectApi.applyWorkflowTemplate(project.id, templateId, {
        ...(variables ? { variables } : {}),
      });
      const nextProject = res.data as VideoProject;
      set({
        project: nextProject,
        selectedClipId: nextProject.clips?.[0]?.id ?? null,
        loading: false,
      });
      get().loadProjects();
    } catch (err) {
      set({ loading: false, lastError: extractErrorMessage(err) });
      throw err;
    }
  },

  applyVideoTemplate: async (templateId, variables) => {
    const { project } = get();
    if (!project || isLocalProject(project)) return;
    set({ loading: true, lastError: null });
    try {
      const res = await videoProjectApi.applyVideoTemplate(project.id, templateId, {
        ...(variables ? { variables } : {}),
      });
      const nextProject = res.data as VideoProject;
      set({
        project: nextProject,
        selectedClipId: nextProject.clips?.[0]?.id ?? null,
        loading: false,
      });
      get().loadProjects();
    } catch (err) {
      set({ loading: false, lastError: extractErrorMessage(err) });
      throw err;
    }
  },
}));
