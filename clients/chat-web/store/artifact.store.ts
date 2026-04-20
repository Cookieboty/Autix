import { create } from 'zustand';
import { artifactApi, type Artifact, type ArtifactVersion } from '@/lib/api';
import { useChatStore } from './chat.store';

interface ArtifactState {
  // 当前会话的产物（每个会话只有一个）
  activeArtifact: Artifact | null;

  // 编辑器状态
  viewMode: 'preview' | 'edit' | 'split';
  editingContent: string;
  isDirty: boolean;

  // 版本
  versions: ArtifactVersion[];

  // Monaco Editor 实例引用（用于控制）
  editorInstance: any | null;

  // Actions
  setActiveArtifact: (artifact: Artifact | null) => void;
  setViewMode: (mode: 'preview' | 'edit' | 'split') => void;
  setEditorInstance: (editor: any | null) => void;
  updateEditingContent: (content: string) => void;
  saveArtifact: () => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
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

  saveArtifact: async () => {
    const { activeArtifact, editingContent, isDirty } = get();
    if (!activeArtifact || !isDirty) return;

    try {
      const response = await artifactApi.updateArtifact(
        activeArtifact.id,
        editingContent,
      );

      set({
        activeArtifact: response.data,
        isDirty: false,
      });
    } catch (error) {
      console.error('保存产物失败:', error);
      throw error;
    }
  },

  updateTitle: async (title) => {
    const { activeArtifact } = get();
    if (!activeArtifact) return;

    try {
      // 调用 API，后端会同步更新 Conversation 标题
      await artifactApi.updateTitle(activeArtifact.id, title);

      set({
        activeArtifact: { ...activeArtifact, title },
      });

      // 触发会话列表刷新，以显示新标题
      const chatStore = useChatStore.getState();
      if (chatStore.fetchSessions) {
        await chatStore.fetchSessions();
      }
    } catch (error) {
      console.error('更新标题失败:', error);
      throw error;
    }
  },

  loadVersions: async (artifactId) => {
    try {
      const response = await artifactApi.getVersions(artifactId);
      set({ versions: response.data });
    } catch (error) {
      console.error('加载版本历史失败:', error);
      throw error;
    }
  },

  revertToVersion: async (version) => {
    const { activeArtifact, editorInstance } = get();
    if (!activeArtifact) return;

    try {
      const response = await artifactApi.revertToVersion(
        activeArtifact.id,
        version,
      );
      const reverted = response.data;

      // 重置编辑器状态（清空 Undo/Redo 历史）
      if (editorInstance) {
        const model = editorInstance.getModel();
        if (model) {
          // 推入一个新的编辑操作，清空历史栈
          editorInstance.pushUndoStop();
          model.setValue(reverted.content);
          editorInstance.pushUndoStop();
        }
      }

      set({
        activeArtifact: reverted,
        editingContent: reverted.content,
        isDirty: false,
      });

      // 重新加载版本列表
      await get().loadVersions(activeArtifact.id);
    } catch (error) {
      console.error('恢复版本失败:', error);
      throw error;
    }
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
