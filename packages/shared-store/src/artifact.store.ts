import { create } from 'zustand';
import { artifactApi, type Artifact, type ArtifactVersion } from '@autix/sdk';
import { useChatStore } from './chat.store';

interface ArtifactState {
  activeArtifact: Artifact | null;
  viewMode: 'preview' | 'split';
  editingContent: string;
  isDirty: boolean;
  versions: ArtifactVersion[];
  editorInstance: unknown | null;

  setActiveArtifact: (artifact: Artifact | null) => void;
  setViewMode: (mode: 'preview' | 'split') => void;
  setEditorInstance: (editor: unknown | null) => void;
  updateEditingContent: (content: string) => void;
  loadArtifactByConversation: (conversationId: string) => Promise<void>;
  loadArtifactById: (artifactId: string) => Promise<void>;
  saveArtifact: () => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
  refreshActiveArtifact: () => Promise<void>;
  loadVersions: (artifactId: string) => Promise<void>;
  revertToVersion: (version: number) => Promise<void>;
  clearArtifact: () => void;
}

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  activeArtifact: null,
  viewMode: 'preview',
  editingContent: '',
  isDirty: false,
  versions: [],
  editorInstance: null,

  setActiveArtifact: (artifact) => {
    if (!artifact) {
      set({
        activeArtifact: null,
        editingContent: '',
        isDirty: false,
        versions: [],
      });
      return;
    }

    set({
      activeArtifact: artifact,
      editingContent: artifact.content,
      isDirty: false,
      versions: artifact.versions || [],
    });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setEditorInstance: (editor) => set({ editorInstance: editor }),

  updateEditingContent: (content) => {
    const { activeArtifact } = get();
    set({
      editingContent: content,
      isDirty: content !== activeArtifact?.content,
    });
  },

  loadArtifactByConversation: async (conversationId) => {
    try {
      const response = await artifactApi.getByConversation(conversationId);
      if (response.data) {
        get().setActiveArtifact(response.data);
      } else {
        get().clearArtifact();
      }
    } catch {
      get().clearArtifact();
      throw new Error('Failed to load artifact');
    }
  },

  loadArtifactById: async (artifactId) => {
    const response = await artifactApi.getArtifact(artifactId);
    if (response.data) {
      get().setActiveArtifact(response.data);
    }
  },

  saveArtifact: async () => {
    const { activeArtifact, editingContent, isDirty } = get();
    if (!activeArtifact || !isDirty) return;

    const response = await artifactApi.updateArtifact(activeArtifact.id, editingContent);
    set({
      activeArtifact: response.data,
      isDirty: false,
    });
  },

  updateTitle: async (title) => {
    const { activeArtifact } = get();
    if (!activeArtifact) return;

    await artifactApi.updateTitle(activeArtifact.id, title);
    set({
      activeArtifact: { ...activeArtifact, title },
    });

    const chatStore = useChatStore.getState();
    if (chatStore.fetchSessions) {
      await chatStore.fetchSessions();
    }
  },

  refreshActiveArtifact: async () => {
    const { activeArtifact } = get();
    if (!activeArtifact) return;

    const response = await artifactApi.getArtifact(activeArtifact.id);
    set({
      activeArtifact: response.data,
      editingContent: response.data.content,
      isDirty: false,
      versions: response.data.versions || [],
    });
  },

  loadVersions: async (artifactId) => {
    const response = await artifactApi.getVersions(artifactId);
    set({ versions: response.data });
  },

  revertToVersion: async (version) => {
    const { activeArtifact, editorInstance } = get();
    if (!activeArtifact) return;

    const response = await artifactApi.revertToVersion(activeArtifact.id, version);
    const reverted = response.data;

    if (editorInstance && typeof editorInstance === 'object') {
      const ed = editorInstance as { getModel?: () => { setValue: (s: string) => void } | null; pushUndoStop?: () => void };
      const model = ed.getModel?.();
      if (model) {
        ed.pushUndoStop?.();
        model.setValue(reverted.content);
        ed.pushUndoStop?.();
      }
    }

    set({
      activeArtifact: reverted,
      editingContent: reverted.content,
      isDirty: false,
    });

    await get().loadVersions(activeArtifact.id);
  },

  clearArtifact: () =>
    set({
      activeArtifact: null,
      editingContent: '',
      isDirty: false,
      versions: [],
      editorInstance: null,
    }),
}));
