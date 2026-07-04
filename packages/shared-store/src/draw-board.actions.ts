import {
  appendConversationMessage,
  canvasBoardApi,
  createConversation,
  getAvailableModels,
  getConversationMessages,
  getConversations,
  pointsApi,
  updateConversationTitle,
  videoProjectApi,
  type CanvasBoardStateResponse,
  type CanvasChatGenerateResponse,
  type CanvasSaveStateResponse,
  type Conversation,
  type ConversationMessage,
  type ModelConfigItem,
} from '@autix/sdk';
import { hasImageCapability, isVideoModel, type CanvasBoardState } from '@autix/domain';

export type {
  CanvasBoardStateResponse,
  CanvasChatGenerateResponse,
  Conversation,
  ConversationMessage,
  ModelConfigItem,
} from '@autix/sdk';

const DRAW_BOARD_DESCRIPTION_PREFIX = 'draw:conversation:';
let firstDrawConversationInFlight: Promise<Conversation> | null = null;

function isImageModel(model: ModelConfigItem): boolean {
  // Match the backend, which classifies image models by capability
  // (hasImageCapability). The old `type === 'image'` check was dead — the
  // ModelType enum has no `image` value — so capability-only models that lack a
  // metadata.imageModelKind were dropped, showing "暂无模型".
  return hasImageCapability(model.capabilities ?? []) || Boolean(model.metadata?.imageModelKind);
}

async function createFirstDrawConversation(): Promise<Conversation> {
  if (!firstDrawConversationInFlight) {
    firstDrawConversationInFlight = createConversation({ title: '新绘制对话', kind: 'image' })
      .then((res) => res.data)
      .finally(() => {
        firstDrawConversationInFlight = null;
      });
  }
  return firstDrawConversationInFlight;
}

// Thin async actions so shared-ui never touches the SDK directly
// (shared-ui -> shared-store -> sdk).
export const drawBoardActions = {
  ensureBoard: async (title: string): Promise<string> => {
    const list = await canvasBoardApi.list();
    const existing = list.data.items[0];
    if (existing) return existing.id;
    const created = await canvasBoardApi.create({ title });
    return created.data.board.id;
  },

  listConversations: async (): Promise<Conversation[]> => {
    const res = await getConversations();
    return res.data;
  },

  createConversation: async (title?: string): Promise<Conversation> => {
    const res = await createConversation({ title: title || '新绘制对话', kind: 'image' });
    return res.data;
  },

  ensureConversation: async (conversationId?: string | null): Promise<Conversation> => {
    const conversations = await drawBoardActions.listConversations();
    if (conversationId) {
      const requested = conversations.find((item) => item.id === conversationId);
      if (requested) return requested;
    }
    const latest = conversations[0];
    if (latest) return latest;
    return createFirstDrawConversation();
  },

  ensureBoardForConversation: async (conversation: Pick<Conversation, 'id' | 'title'>): Promise<string> => {
    const marker = `${DRAW_BOARD_DESCRIPTION_PREFIX}${conversation.id}`;
    const list = await canvasBoardApi.list();
    const existing = list.data.items.find((board) => board.description === marker);
    if (existing) return existing.id;
    const created = await canvasBoardApi.create({
      title: conversation.title || '绘制对话',
      description: marker,
    });
    return created.data.board.id;
  },

  getConversationMessages: async (conversationId: string): Promise<ConversationMessage[]> => {
    const res = await getConversationMessages(conversationId);
    return res.data;
  },

  appendConversationMessage: async (
    conversationId: string,
    data: {
      role: 'USER' | 'ASSISTANT';
      content: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ConversationMessage> => {
    const res = await appendConversationMessage(conversationId, data);
    return res.data;
  },

  updateConversationTitle: async (conversationId: string, title: string): Promise<void> => {
    await updateConversationTitle(conversationId, title);
  },

  getState: async (boardId: string): Promise<CanvasBoardStateResponse> => {
    const res = await canvasBoardApi.getState(boardId);
    return res.data;
  },

  saveState: async (
    boardId: string,
    state: CanvasBoardState,
    revision: number,
  ): Promise<CanvasSaveStateResponse> => {
    const res = await canvasBoardApi.saveStateWithVersion(boardId, { state }, revision);
    return res.data;
  },

  updateBoard: async (
    boardId: string,
    data: { title?: string; description?: string },
  ): Promise<CanvasBoardStateResponse['board']> => {
    const res = await canvasBoardApi.update(boardId, data);
    return res.data.board;
  },

  chatGenerate: async (
    boardId: string,
    body: { idempotencyKey: string; prompt: string; modelConfigId: string; referenceImageUrls?: string[]; count?: number },
  ): Promise<CanvasChatGenerateResponse> => {
    const res = await canvasBoardApi.chatGenerate(boardId, body);
    return res.data;
  },

  /** Pick an available image model config id (default first). */
  listImageModels: async (): Promise<ModelConfigItem[]> => {
    const res = await getAvailableModels();
    const models = res.data ?? [];
    return models.filter(isImageModel);
  },

  resolveImageModelConfigId: async (): Promise<string | null> => {
    const imageModels = await drawBoardActions.listImageModels();
    const chosen = imageModels.find((m) => m.isDefault) ?? imageModels[0];
    return chosen?.id ?? null;
  },

  /** Available video models — used when the workspace is in video mode. */
  listVideoModels: async (): Promise<ModelConfigItem[]> => {
    const res = await getAvailableModels();
    const models = res.data ?? [];
    return models.filter(isVideoModel);
  },

  /**
   * Start a video generation from the draw workspace. Draw conversations are
   * `kind:'image'`, which the video-project API refuses to bind, so we use a
   * standalone project purely as the generation vehicle and surface the result
   * back in the draw UI ourselves. Pass a cached `projectId` to reuse one
   * standalone project across a session (each call adds a fresh clip).
   */
  startVideoGeneration: async (opts: {
    projectId?: string;
    title: string;
    prompt: string;
    modelConfigId: string;
    referenceImageUrls?: string[];
    duration?: number;
    ratio?: string;
    resolution?: string;
  }): Promise<{ projectId: string; generationId: string }> => {
    const projectId =
      opts.projectId ??
      ((await videoProjectApi.create({ title: opts.title || '绘制视频', standalone: true }))
        .data as { id: string }).id;

    const clip = (await videoProjectApi.addClip(projectId, {
      prompt: opts.prompt,
      params: {
        modelConfigId: opts.modelConfigId,
        generationMode: 'standard',
        duration: opts.duration ?? 5,
        ratio: opts.ratio ?? '16:9',
        resolution: opts.resolution ?? '1080p',
        generateAudio: true,
      },
    }).then((res) => res.data as { id: string }));

    // Only http(s) URLs can be sent as materials; data: URLs (composer uploads)
    // aren't reachable by the generation backend, so we skip them.
    const httpRefs = (opts.referenceImageUrls ?? []).filter((url) => /^https?:/i.test(url));
    for (let i = 0; i < httpRefs.length; i += 1) {
      await videoProjectApi.addMaterial(projectId, clip.id, {
        role: i === 0 ? 'first_frame' : 'reference_image',
        sourceType: 'image_generation',
        url: httpRefs[i],
      });
    }

    const gen = (await videoProjectApi.generateClip(projectId, clip.id)).data;
    return { projectId, generationId: gen.generationId };
  },

  /**
   * Poll a video generation until it reaches a terminal state. There is no time
   * limit — a generation always resolves to a result (the backend eventually
   * marks it completed/failed/expired), and transient network errors just retry
   * on the next tick.
   */
  pollVideoGeneration: async (
    projectId: string,
    generationId: string,
    onTick?: (status: string) => void,
  ): Promise<{ status: string; videoUrl?: string | null; thumbnailUrl?: string | null; error?: string | null }> => {
    const TERMINAL = new Set(['completed', 'failed', 'expired']);
    const INTERVAL_MS = 3_000;
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      let hit: { status: string; videoUrl?: string | null; thumbnailUrl?: string | null; error?: string | null } | undefined;
      try {
        hit = (await videoProjectApi.refreshGeneration(projectId, generationId)).data;
      } catch {
        try {
          const list = (await videoProjectApi.getGenerations(projectId)).data ?? [];
          hit = list.find((item) => item.id === generationId);
        } catch {
          continue;
        }
      }
      if (!hit) continue;
      onTick?.(hit.status);
      if (TERMINAL.has(hit.status)) {
        return { status: hit.status, videoUrl: hit.videoUrl, thumbnailUrl: hit.thumbnailUrl, error: hit.error };
      }
    }
  },

  /** Spendable points balance for the credits indicator. */
  getCredits: async (): Promise<number> => {
    const res = await pointsApi.getBalance();
    return res.data.availableBalance ?? res.data.balance ?? 0;
  },
};
