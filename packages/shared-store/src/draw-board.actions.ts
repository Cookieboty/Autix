import {
  appendConversationMessage,
  canvasBoardApi,
  createConversation,
  getAvailableModels,
  getConversationMessages,
  getConversations,
  pointsApi,
  updateConversationTitle,
  uploadToPresignedUrl,
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
const DRAW_VIDEO_UPLOAD_FOLDER = 'amux-studio/draw-video-inputs';
// Cap the summed storyboard duration (backend sums per-clip durations and
// rejects requests over the model/entitlement limit).
const STORYBOARD_TOTAL_DURATION_CAP = 15;
let firstDrawConversationInFlight: Promise<Conversation> | null = null;

type DrawVideoCompositionMode =
  | 'text_to_video'
  | 'reference'
  | 'image_to_video'
  | 'first_last_frame'
  | 'storyboard';

interface DrawVideoCompositionIssue {
  level: 'warning' | 'blocking';
  code?: string;
  message?: string;
}

interface DrawVideoCompositionShot {
  prompt: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
}

export interface DrawVideoCompositionInput {
  mode: DrawVideoCompositionMode;
  prompt: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls: string[];
  shots: DrawVideoCompositionShot[];
  issues?: DrawVideoCompositionIssue[];
  params?: {
    modelConfigId?: string;
    duration?: number;
    ratio?: string;
    resolution?: string;
    generateAudio?: boolean;
  };
}

interface StartVideoCompositionOptions {
  modelConfigId?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
}

type VideoMaterialRole = 'first_frame' | 'last_frame' | 'reference_image';

interface VideoProjectClipRecord {
  id: string;
}

function isImageModel(model: ModelConfigItem): boolean {
  // Match the backend, which classifies image models by capability
  // (hasImageCapability). The old `type === 'image'` check was dead — the
  // ModelType enum has no `image` value — so capability-only models that lack a
  // metadata.imageModelKind were dropped, showing "暂无模型".
  return hasImageCapability(model.capabilities ?? []) || Boolean(model.metadata?.imageModelKind);
}

function isDataUrl(url: string): boolean {
  return /^data:/i.test(url);
}

function dataUrlContentType(url: string): string {
  const match = /^data:([^;,]+)/i.exec(url);
  return match?.[1] || 'application/octet-stream';
}

function fileExtensionForContentType(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('png')) return 'png';
  return 'bin';
}

function isNotFoundError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 404;
}

/**
 * Upload any `data:` material URLs to object storage so the generation backend
 * can reach them; http(s) URLs pass through unchanged. A failed upload is
 * SKIPPED (left out of the map), not thrown — the caller then drops that one
 * material rather than aborting the whole generation, preserving the graceful
 * degradation the old `/^https?:/i` filter provided.
 */
export async function uploadDataUrlsToHttp(urls: readonly string[]): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  // Upload the data: URLs concurrently — each is an independent fetch+presign+PUT
  // round-trip and serialising them needlessly slows generation.
  await Promise.all(uniqueUrls.map(async (url, index) => {
    if (!isDataUrl(url)) {
      resolved[url] = url;
      return;
    }
    try {
      const contentType = dataUrlContentType(url);
      const ext = fileExtensionForContentType(contentType);
      const blob = await fetch(url).then((res) => res.blob());
      const presign = await videoProjectApi.uploadUrl({
        fileName: `draw-video-${Date.now()}-${index}.${ext}`,
        contentType,
        folder: DRAW_VIDEO_UPLOAD_FOLDER,
      });
      const uploadRes = await uploadToPresignedUrl(presign.data.uploadUrl, blob, { contentType });
      if (uploadRes.ok) resolved[url] = presign.data.publicUrl;
    } catch {
      // Leave the data URL unresolved so the caller skips this material.
    }
  }));
  return resolved;
}

/**
 * Returns the reachable http(s) URL for a material, or `undefined` when a
 * `data:` URL could not be uploaded — callers must skip an undefined material
 * rather than pass an unreachable data URL to the backend.
 */
function resolveUploadedUrl(uploadedUrls: Record<string, string>, url: string | undefined): string | undefined {
  if (!url) return undefined;
  const mapped = uploadedUrls[url];
  if (mapped) return mapped;
  return isDataUrl(url) ? undefined : url;
}

function uniqueUrls(urls: readonly (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

function collectCompositionUrls(composition: DrawVideoCompositionInput): string[] {
  return uniqueUrls([
    composition.firstFrameUrl,
    composition.lastFrameUrl,
    ...composition.referenceUrls,
    ...composition.shots.flatMap((shot) => [shot.firstFrameUrl, shot.lastFrameUrl]),
  ]);
}

function resolveModelConfigId(
  composition: DrawVideoCompositionInput,
  opts?: StartVideoCompositionOptions,
): string {
  const modelConfigId = opts?.modelConfigId ?? composition.params?.modelConfigId;
  if (!modelConfigId) throw new Error('缺少视频模型');
  return modelConfigId;
}

function buildSingleClipParams(
  composition: DrawVideoCompositionInput,
  opts?: StartVideoCompositionOptions,
): Record<string, unknown> {
  return {
    modelConfigId: resolveModelConfigId(composition, opts),
    generationMode: composition.mode === 'storyboard' ? 'storyboard' : 'standard',
    duration: opts?.duration ?? composition.params?.duration ?? 5,
    ratio: opts?.ratio ?? composition.params?.ratio ?? '16:9',
    resolution: opts?.resolution ?? composition.params?.resolution ?? '1080p',
    generateAudio: opts?.generateAudio ?? composition.params?.generateAudio ?? true,
    ...(composition.mode === 'storyboard' && composition.prompt.trim()
      ? { storyboardPrompt: composition.prompt.trim() }
      : {}),
  };
}

function assertCompositionReady(composition: DrawVideoCompositionInput): void {
  const blocking = composition.issues?.find((item) => item.level === 'blocking');
  if (blocking) throw new Error(blocking.message || blocking.code || '视频生成配置未通过预检');
}

function readProjectClips(response: unknown): VideoProjectClipRecord[] {
  const data = response && typeof response === 'object' && 'data' in response
    ? (response as { data?: unknown }).data
    : response;
  if (!data || typeof data !== 'object') return [];
  const clips = (data as { clips?: unknown }).clips;
  if (!Array.isArray(clips)) return [];
  return clips
    .map((clip) => (clip && typeof clip === 'object' ? (clip as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id }));
}

async function replaceProjectClips(projectId: string): Promise<void> {
  const project = await videoProjectApi.getById(projectId);
  const clips = readProjectClips(project);
  for (const clip of clips) {
    await videoProjectApi.deleteClip(projectId, clip.id);
  }
}

async function addCompositionMaterial(
  projectId: string,
  clipId: string,
  role: VideoMaterialRole,
  originalUrl: string,
  uploadedUrls: Record<string, string>,
): Promise<void> {
  const url = resolveUploadedUrl(uploadedUrls, originalUrl);
  // Skip a material whose data: URL failed to upload — passing an unreachable
  // data URL to the backend would fail the whole generation.
  if (!url) return;
  await videoProjectApi.addMaterial(projectId, clipId, {
    role,
    sourceType: isDataUrl(originalUrl) ? 'upload' : 'image_generation',
    url,
  });
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

  ensureVideoProjectForNode: async (opts: {
    projectId?: string | null;
    title: string;
  }): Promise<{ projectId: string }> => {
    if (opts.projectId) {
      try {
        await videoProjectApi.getById(opts.projectId);
        return { projectId: opts.projectId };
      } catch (error) {
        // Only recreate when the project is genuinely gone (404). A transient
        // 5xx/network error or a 403 must NOT orphan the existing project and
        // its generated result by silently creating a fresh empty one.
        if (!isNotFoundError(error)) throw error;
      }
    }
    const created = await videoProjectApi.create({
      title: opts.title || '画布视频',
      standalone: true,
    });
    return { projectId: (created.data as { id: string }).id };
  },

  optimizeVideoPrompt: async (input: { prompt: string; modelId?: string }): Promise<string> => {
    const res = await videoProjectApi.optimizePrompt(input);
    return res.data.optimizedPrompt;
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

    const materialUrls = opts.referenceImageUrls ?? [];
    const uploadedUrls = await uploadDataUrlsToHttp(materialUrls);
    for (let i = 0; i < materialUrls.length; i += 1) {
      await addCompositionMaterial(
        projectId,
        clip.id,
        i === 0 ? 'first_frame' : 'reference_image',
        materialUrls[i],
        uploadedUrls,
      );
    }

    const gen = (await videoProjectApi.generateClip(projectId, clip.id)).data;
    return { projectId, generationId: gen.generationId };
  },

  /**
   * Start generation from the v5 canvas composition contract. This is the new
   * P2 entrypoint used by video nodes; the legacy composer path above stays in
   * place until the UI is migrated.
   */
  startVideoComposition: async (
    projectId: string,
    composition: DrawVideoCompositionInput,
    opts?: StartVideoCompositionOptions,
  ): Promise<{ projectId: string; generationId: string }> => {
    assertCompositionReady(composition);
    const params = buildSingleClipParams(composition, opts);
    // Do every fallible read/upload BEFORE the destructive replaceProjectClips,
    // so a failed upload can't leave the project with zero clips (data loss).
    const uploadedUrls = await uploadDataUrlsToHttp(collectCompositionUrls(composition));
    await replaceProjectClips(projectId);

    if (composition.mode === 'storyboard') {
      if (composition.shots.length === 0) throw new Error('分镜模式需要至少一个镜头');

      // Backend sums per-clip durations for a storyboard; cap the per-shot
      // duration so the total stays within the model/entitlement limit.
      const perShotDuration = Math.max(
        2,
        Math.min(
          Number(params.duration) || 5,
          Math.floor(STORYBOARD_TOTAL_DURATION_CAP / composition.shots.length),
        ),
      );
      const shotParams = { ...params, duration: perShotDuration };

      for (let i = 0; i < composition.shots.length; i += 1) {
        const shot = composition.shots[i];
        const clip = (await videoProjectApi.addClip(projectId, {
          title: `镜头 ${i + 1}`,
          prompt: shot.prompt,
          params: shotParams,
          chainFromPrev: i > 0,
        }).then((res) => res.data as { id: string }));

        if (shot.firstFrameUrl) {
          await addCompositionMaterial(projectId, clip.id, 'first_frame', shot.firstFrameUrl, uploadedUrls);
        }
        if (shot.lastFrameUrl) {
          await addCompositionMaterial(projectId, clip.id, 'last_frame', shot.lastFrameUrl, uploadedUrls);
        }
      }

      const triggered = (await videoProjectApi.generateAll(projectId)).data ?? [];
      const generationId = triggered[0]?.generationId;
      if (!generationId) throw new Error('分镜生成任务未创建');
      return { projectId, generationId };
    }

    const clip = (await videoProjectApi.addClip(projectId, {
      prompt: composition.prompt,
      params,
      chainFromPrev: false,
    }).then((res) => res.data as { id: string }));

    if (composition.mode === 'image_to_video') {
      if (!composition.firstFrameUrl) throw new Error('图生视频需要首帧图片');
      await addCompositionMaterial(projectId, clip.id, 'first_frame', composition.firstFrameUrl, uploadedUrls);
    }

    if (composition.mode === 'first_last_frame') {
      if (!composition.firstFrameUrl || !composition.lastFrameUrl) throw new Error('首尾帧模式需要首帧和尾帧图片');
      await addCompositionMaterial(projectId, clip.id, 'first_frame', composition.firstFrameUrl, uploadedUrls);
      await addCompositionMaterial(projectId, clip.id, 'last_frame', composition.lastFrameUrl, uploadedUrls);
    }

    if (composition.mode === 'reference') {
      if (composition.referenceUrls.length === 0) throw new Error('参考图模式需要至少一张图片');
      for (const url of composition.referenceUrls) {
        await addCompositionMaterial(projectId, clip.id, 'reference_image', url, uploadedUrls);
      }
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
    opts?: { signal?: AbortSignal },
  ): Promise<{ status: string; videoUrl?: string | null; thumbnailUrl?: string | null; error?: string | null }> => {
    const TERMINAL = new Set(['completed', 'failed', 'expired']);
    const INTERVAL_MS = 3_000;
    // Consecutive polls where the generation is a hard 404 in BOTH endpoints —
    // it was deleted/never existed. Terminate as failed so the caller's spinner
    // can't hang forever. (There is no wall-clock timeout by design.)
    let missingStreak = 0;
    for (;;) {
      if (opts?.signal?.aborted) return { status: 'cancelled' };
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      if (opts?.signal?.aborted) return { status: 'cancelled' };

      let hit: { status: string; videoUrl?: string | null; thumbnailUrl?: string | null; error?: string | null } | undefined;
      let notFound = false;
      try {
        hit = (await videoProjectApi.refreshGeneration(projectId, generationId)).data;
      } catch (error) {
        notFound = isNotFoundError(error);
        try {
          const list = (await videoProjectApi.getGenerations(projectId)).data ?? [];
          hit = list.find((item) => item.id === generationId);
          if (!hit && isNotFoundError(error)) notFound = true;
        } catch {
          // Transient failure of both endpoints — retry next tick.
          continue;
        }
      }
      if (!hit) {
        missingStreak = notFound ? missingStreak + 1 : 0;
        if (missingStreak >= 3) {
          return { status: 'failed', error: '生成任务不存在或已被删除' };
        }
        continue;
      }
      missingStreak = 0;
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
