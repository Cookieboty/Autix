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

  loadProject: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  createProject: (title: string) => Promise<VideoProject>;
  setProject: (project: VideoProject | null) => void;
  selectClip: (clipId: string | null) => void;

  addClip: (data: { title?: string; prompt?: string; params: Record<string, unknown>; chainFromPrev?: boolean }) => Promise<void>;
  updateClip: (clipId: string, data: { title?: string; prompt?: string; params?: Record<string, unknown>; chainFromPrev?: boolean }) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;

  addMaterial: (clipId: string, data: { role: string; sourceType: string; sourceId?: string; url: string; name?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  removeMaterial: (materialId: string) => Promise<void>;

  generateClip: (clipId: string, variantLabel?: string) => Promise<void>;
  generateAll: () => Promise<void>;

  createFromTemplate: (templateId: string, variables?: Record<string, string>) => Promise<void>;
}

export const useVideoProjectStore = create<VideoProjectState>((set, get) => ({
  project: null,
  projects: [],
  selectedClipId: null,
  generatingClipIds: [],
  loading: false,

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
    set({ generatingClipIds: [...get().generatingClipIds, clipId] });
    try {
      await videoProjectApi.generateClip(project.id, clipId, { variantLabel });
      await get().loadProject(project.id);
    } finally {
      set({ generatingClipIds: get().generatingClipIds.filter((id) => id !== clipId) });
    }
  },

  generateAll: async () => {
    const { project } = get();
    if (!project) return;
    const clipIds = project.clips.map((c) => c.id);
    set({ generatingClipIds: clipIds });
    try {
      await videoProjectApi.generateAll(project.id);
      await get().loadProject(project.id);
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
