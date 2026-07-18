// 领域 API 集合。请求基础设施（鉴权/刷新/SSE/上传/axios 实例工厂）已抽到 ./client-core。
import type {
  TaskEvent,
  CanvasAction,
  CanvasActionEstimate,
  CanvasBoard,
  CanvasBoardState,
  CanvasEntitlement,
  AvatarPresignResult,
  BannerPresignResult,
  PublicProfile,
} from '@autix/domain';
import { createApiInstance, getApiBaseUrl, LLM_REQUEST_TIMEOUT_MS } from './client-core';

export const userApi = createApiInstance(
  getApiBaseUrl,
  getApiBaseUrl,
);
export const chatApi = createApiInstance(
  getApiBaseUrl,
  getApiBaseUrl,
);

// ── Common typed wrappers ────────────────────────────────────────────────
export const updateMyLanguage = (language: string) =>
  userApi.patch('/users/me/language', { language });

export const updateMyAutoPublish = (autoPublish: boolean) =>
  userApi.patch('/users/me/auto-publish', { autoPublish });

export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  systemCode: string;
  inviteCode?: string;
}) => userApi.post('/auth/register', data);

// ── OAuth Account Linking ────────────────────────────────────────────────
export const getLinkedAccounts = () =>
  userApi.get<{ providers: string[] }>('/auth/linked-accounts');

export const startLinkOAuth = (
  provider: string,
  // 安全（#3）：link/unlink 需携带 step-up 一次性 proof（purpose='unlink-provider'）。
  body: { systemCode: string; clientType: string; redirectUri: string; proof: string },
) => userApi.post<{ authorizeUrl: string }>(`/auth/link/${provider}`, body);

export const unlinkOAuth = (provider: string, proof: string) =>
  userApi.delete(`/auth/unlink/${provider}`, { data: { proof } });

// ── Conversations ────────────────────────────────────────────────────────
export type ConversationKind = 'chat' | 'video' | 'image' | 'avatar';

export type ChatAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface ChatAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
}

export interface ConversationAgentRef {
  id: string;
  name: string;
  kind: ConversationKind;
}

export interface ConversationProjectMeta {
  projectId: string;
  status: string;
  clipCount: number;
}

export interface Conversation {
  id: string;
  title: string;
  kind: ConversationKind;
  agentId: string | null;
  agent: ConversationAgentRef | null;
  projectMeta: ConversationProjectMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationVideoProjectMeta {
  id: string;
  title: string;
  status: string;
  coverImage: string | null;
  clipCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  userId: string;
  title: string;
  kind: ConversationKind;
  agentId: string | null;
  agent: ConversationAgentRef | null;
  videoProject: ConversationVideoProjectMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  messageType?: string;
  uiResponse?: unknown;
  thinking?: string;
  metadata?: Record<string, unknown>;
}

export const getConversations = (kind?: ConversationKind) =>
  chatApi.get<Conversation[]>('/api/conversations', {
    params: kind ? { kind } : undefined,
  });
export const getConversationDetail = (id: string) =>
  chatApi.get<ConversationDetail>(`/api/conversations/${id}`);
export const updateConversationKind = (id: string, kind: ConversationKind) =>
  chatApi.patch<ConversationDetail>(`/api/conversations/${id}/kind`, { kind });
export const updateConversationTitle = (id: string, title: string) =>
  chatApi.patch<ConversationDetail>(`/api/conversations/${id}/title`, { title });
export const createConversation = (
  input?:
    | string
    | { title?: string; kind?: ConversationKind; agentId?: string | null },
) => {
  const body =
    typeof input === 'string' || input == null
      ? { title: input as string | undefined }
      : input;
  return chatApi.post<Conversation>('/api/conversations', body);
};
export const deleteConversation = (id: string) => chatApi.delete(`/api/conversations/${id}`);
export const getConversationMessages = (id: string, limit?: number) =>
  chatApi.get<ConversationMessage[]>(`/api/conversations/${id}/messages`, {
    params: limit ? { limit } : undefined,
  });
export const appendConversationMessage = (
  id: string,
  data: {
    role: 'USER' | 'ASSISTANT';
    content: string;
    metadata?: Record<string, unknown>;
  },
) => chatApi.post<ConversationMessage>(`/api/conversations/${id}/messages`, data);

export interface ConversationImageItem {
  messageId: string;
  createdAt: string;
  url: string;
  prompt?: string;
  generationId?: string;
}

export interface ConversationImagesResponse {
  items: ConversationImageItem[];
  total: number;
}

export const getConversationImages = (id: string, limit?: number) =>
  chatApi.get<ConversationImagesResponse>(`/api/conversations/${id}/images`, {
    params: limit ? { limit } : undefined,
  });

export interface ConversationSourceImage {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface ConversationImageSettings {
  size?: string;
  quality?: string;
  promptTuning?: string;
  stylePreset?: string;
  negativePrompt?: string;
  skipPromptTuning?: boolean;
}

export const generateConversationImage = (
  id: string,
  data: {
    model: string;
    templateId: string;
    variables?: Record<string, string>;
    promptOverride?: string;
    sourceImages?: ConversationSourceImage[];
    referenceImages?: ConversationSourceImage[];
    editInstruction?: string;
    settings?: ConversationImageSettings;
  },
) => chatApi.post(`/api/conversations/${id}/generate-image`, data);

// ── Documents ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDocuments = () => chatApi.get<any[]>('/api/documents');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDocumentWithChunks = (id: string) => chatApi.get<any>(`/api/documents/${id}`);
export const uploadDocument = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  form.append('filename', file.name);
  return chatApi.post('/api/documents/upload', form);
};
export const processDocument = (id: string) =>
  chatApi.post(`/api/documents/${id}/process`);
export const deleteDocument = (id: string) => chatApi.delete(`/api/documents/${id}`);

// ── Tasks ────────────────────────────────────────────────────────────────
export type { TaskEvent };

export const getTaskHistory = (params?: {
  page?: number;
  pageSize?: number;
  taskType?: string;
  startDate?: string;
  endDate?: string;
}) =>
  chatApi.get<{
    items: TaskEvent[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }>('/api/tasks/history', { params });

export const markTaskRead = (taskId: string) =>
  chatApi.patch<{ readAt: string }>(`/api/tasks/${taskId}/read`);

// ── Models ───────────────────────────────────────────────────────────────
export interface ModelConfigItem {
  id: string;
  name: string;
  model: string;
  provider: string;
  /**
   * 模型简介，i18n map（`{ "en": "...", "zh-CN": "..." }`）。运营在管理端填，可能为 `{}`。
   * 服务端不做 select，整行返回——此前类型里漏了这个字段，前端因此看不到它。
   */
  description?: Record<string, string> | null;
  type: string;
  priority: number;
  isActive?: boolean;
  isDefault: boolean;
  capabilities: string[];
  visibility: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  allowedMembershipLevels?: Array<{
    levelId: string;
    level?: {
      id: string;
      name: string;
      level: number;
      sort?: number | null;
    };
  }>;
  metadata?: {
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    apiKey?: string;
    imageModelKind?: 'gpt-image' | 'gemini-flash-image' | 'gemini-3-pro-image' | 'gemini-3-flash-image' | 'compatible';
    imageGenerationEndpoint?: string;
    imageEditEndpoint?: string;
    imageToImageEndpoint?: string;
    geminiImageSize?: string;
    geminiEndpointVersion?: string;
    videoModelKind?:
    | 'seedance-2.0'
    | 'seedance-2.0-fast'
    | 'seedance-2.0-mini'
    | 'seedance-1.5-pro'
    | 'seedance-1.0-pro'
    | 'seedance-1.0-pro-fast'
    | 'compatible';
    pricingResolutions?: string[];
    supportedResolutions?: string[];
    videoResolutions?: string[];
    resolutions?: string[];
    resolutionOptions?: string[];
    maxResolution?: string;
    videoMaxResolution?: string;
    defaultResolution?: string;
    videoDefaultResolution?: string;
  };
}

export const getAvailableModels = () => chatApi.get<ModelConfigItem[]>('/api/models/available');
export const getPublicAvailableModels = () => chatApi.get<ModelConfigItem[]>('/api/models/public/available');
export const getSystemModels = () => chatApi.get<ModelConfigItem[]>('/api/models/system');
export const createSystemModel = (data: Record<string, unknown>) =>
  chatApi.post<ModelConfigItem>('/api/models/system', data);
export const updateSystemModel = (id: string, data: Record<string, unknown>) =>
  chatApi.put<ModelConfigItem>(`/api/models/system/${id}`, data);
export const deleteSystemModel = (id: string) => chatApi.delete(`/api/models/system/${id}`);

// ── System Settings ─────────────────────────────────────────────────────
export type SystemSettingType = 'boolean' | 'string';
export type SystemSettingCategory =
  | 'features'
  | 'integration'
  | 'payments'
  | 'storage'
  | 'mail'
  | 'oauth';

export interface SystemSettingItem {
  key: string;
  label: string;
  description: string;
  type: SystemSettingType;
  category: SystemSettingCategory;
  editable: boolean;
  sensitive?: boolean;
  allowEmpty?: boolean;
  envKeys: string[];
  defaultValue: string;
  value: string;
  source: 'database' | 'environment';
  updatedAt?: string;
}

export interface PublicSystemSettings {
  features: {
    chatEnabled: boolean;
    libraryEnabled: boolean;
    inviteSharingEnabled: boolean;
  };
  settings: SystemSettingItem[];
}

export const systemSettingsApi = {
  getPublic: () => chatApi.get<PublicSystemSettings>('/api/system-settings/public'),
  getAdmin: () => chatApi.get<SystemSettingItem[]>('/api/admin/system-settings'),
  updateAdmin: (values: Record<string, unknown>) =>
    chatApi.put<SystemSettingItem[]>('/api/admin/system-settings', { values }),
};

// ── System Prompts ─────────────────────────────────────────────────────
export type SystemPromptStatus = 'draft' | 'active' | 'archived';

export interface SystemPromptItem {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  version: string;
  content: string;
  variables: string[];
  status: SystemPromptStatus;
  source: 'database' | 'default';
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface SystemPromptInput {
  key: string;
  name: string;
  description?: string | null;
  version: string;
  content: string;
  variables?: string[];
}

export const systemPromptsApi = {
  list: () => chatApi.get<SystemPromptItem[]>('/api/admin/system-prompts'),
  create: (data: SystemPromptInput) =>
    chatApi.post<SystemPromptItem>('/api/admin/system-prompts', data),
  update: (id: string, data: Partial<Omit<SystemPromptInput, 'key'>>) =>
    chatApi.put<SystemPromptItem>(`/api/admin/system-prompts/${id}`, data),
  publish: (id: string) =>
    chatApi.post<SystemPromptItem>(`/api/admin/system-prompts/${id}/publish`, {}),
};

// ── Material Library ───────────────────────────────────────────────────
export type MaterialAssetType = 'image' | 'video' | 'audio' | 'file';
export type MaterialAssetSourceType = 'upload' | 'image_generation' | 'video_generation' | 'external';

export interface MaterialAsset {
  id: string;
  userId: string;
  type: MaterialAssetType;
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  storageKey?: string | null;
  sourceType: MaterialAssetSourceType;
  sourceId?: string | null;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  /** Plan C Task 1/10：素材库来源维度——上传 / 收藏耦合 / 浏览历史保存，四元唯一含 sourceResourceType+sourceId。 */
  librarySource: MaterialLibrarySource;
  sourceResourceType?: MetricResourceType | null;
  /**
   * Plan C Task 11：list() 才附带的派生字段（deriveSourceState 批量计算）——
   * 'available'（可用）/'unpublished'（Gallery 已下架）/'blocked'（来源不可公开访问）/'missing'（引用已丢失）。
   * UPLOAD 素材恒 'available'（不引用外部资源）。create/update 等单条写接口不返回该字段。
   */
  sourceState?: MaterialSourceState;
}

/** GENERATION：生成流程内联写入的产物（见 api generation-library），/asset 聚合的主体。 */
export type MaterialLibrarySource = 'UPLOAD' | 'FAVORITE' | 'HISTORY' | 'GENERATION';
export type MaterialSourceState = 'available' | 'unpublished' | 'blocked' | 'missing';

/** 素材库按分桶的计数，供 /asset 左侧导航角标。 */
export interface MaterialCounts {
  all: number;
  favorites: number;
  image: number;
  video: number;
  audio: number;
  file: number;
}

export interface MaterialEntitlement {
  canAdd: boolean;
  canUse: boolean;
  reason?: string | null;
  levelName?: string | null;
  expiresAt?: string | null;
}

export interface MaterialListResult {
  items: MaterialAsset[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  entitlement: MaterialEntitlement;
}

export interface MaterialCreateInput {
  type: MaterialAssetType;
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  storageKey?: string | null;
  sourceType: MaterialAssetSourceType;
  sourceId?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  folderId?: string | null;
}

/** A folder record as returned by create/update (no asset count is computed for those endpoints). */
export interface MaterialFolderRow {
  id: string;
  userId: string;
  name: string;
  /** 自定义 emoji 图标；null = 没设过，渲染端回退默认文件夹图形。 */
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A folder enriched with its asset count, as returned by the sidebar listing. */
export interface MaterialFolder extends MaterialFolderRow {
  assetCount: number;
}

export interface MaterialFolderSidebar {
  folders: MaterialFolder[];
  totalAssetCount: number;
  rootAssetCount: number;
}

/** Plan C Task 11：GET /materials/history 单条——原始浏览历史三元组，无标题/封面等预览信息。 */
export interface MaterialHistoryItem {
  id: string;
  resourceType: MetricResourceType;
  resourceId: string;
  viewedAt: string;
}

export interface MaterialHistoryResult {
  items: MaterialHistoryItem[];
  nextCursor: string | null;
}

export const materialsApi = {
  entitlement: () => chatApi.get<MaterialEntitlement>('/api/materials/entitlement'),
  /** /asset 左侧导航角标计数（文件夹计数另见 materialFoldersApi.list 的 assetCount）。 */
  counts: () => chatApi.get<MaterialCounts>('/api/materials/counts'),
  list: (params?: {
    type?: MaterialAssetType | 'all';
    search?: string;
    page?: number;
    pageSize?: number;
    folderId?: string;
    /** Plan C Task 12：素材库来源筛选——不传即"全部"。 */
    librarySource?: MaterialLibrarySource;
    /** 排除收藏（收藏的是别人的作品，只在「收藏」分桶展示）。与 librarySource 互斥。 */
    excludeFavorites?: boolean;
  }) => chatApi.get<MaterialListResult>('/api/materials', { params }),
  /** Plan C Task 11：去重后的浏览历史（按 resourceType+resourceId 取最近一次），游标分页。 */
  history: (params?: { cursor?: string; take?: number }) =>
    chatApi.get<MaterialHistoryResult>('/api/materials/history', { params }),
  /** Plan C Task 11：从浏览历史保存素材——反伪造校验见后端 saveFromHistory（未浏览过则 400）。 */
  saveFromHistory: (resourceType: MetricResourceType, resourceId: string) =>
    chatApi.post<MaterialAsset>('/api/materials/save-from-history', { resourceType, resourceId }),
  uploadUrl: (data: { fileName: string; contentType: string; folder?: string }) =>
    chatApi.post<{ uploadUrl: string; publicUrl: string; key: string }>('/api/materials/upload', data),
  create: (data: MaterialCreateInput) => chatApi.post<MaterialAsset>('/api/materials', data),
  update: (id: string, data: { title?: string; thumbnailUrl?: string | null; tags?: string[]; metadata?: Record<string, unknown> | null; folderId?: string | null }) =>
    chatApi.patch<MaterialAsset>(`/api/materials/${id}`, data),
  remove: (id: string) => chatApi.delete(`/api/materials/${id}`),
  batchDelete: (ids: string[]) => chatApi.post<{ count: number }>('/api/materials/batch-delete', { ids }),
  batchMove: (ids: string[], folderId: string | null) =>
    chatApi.post<{ count: number }>('/api/materials/batch-move', { ids, folderId }),
  use: (id: string) => chatApi.post<MaterialAsset>(`/api/materials/${id}/use`, {}),
  /** Plan C Task 10：下载前置 sourceState 拦截（blocked/missing → 403），不要求会员。 */
  download: (id: string) => chatApi.post<{ downloadUrl: string | null }>(`/api/materials/${id}/download`, {}),
};

// ─── Creative Canvas ──────────────────────────────────────────────────────

export interface CanvasBoardListResponse {
  items: CanvasBoard[];
  entitlement: CanvasEntitlement;
}
export interface CanvasBoardResponse {
  board: CanvasBoard;
  entitlement?: CanvasEntitlement;
}
export interface CanvasBoardStateResponse {
  board: CanvasBoard;
  state: CanvasBoardState;
  entitlement: CanvasEntitlement;
  actions: CanvasAction[];
}
export interface CanvasSaveStateResponse {
  boardRevision: number;
  state: CanvasBoardState;
}
export interface CanvasVersionSummary {
  id: string;
  version: number;
  thumbnailStorageKey?: string | null;
  pinned: boolean;
  createdAt: string;
}
export interface CanvasEstimateInput {
  actionType: string;
  selectedNodeIds: string[];
  modelConfigId?: string;
  count?: number;
}
export interface CanvasImageGenerateInput {
  idempotencyKey: string;
  clientPlaceholderId: string;
  selectedNodeIds: string[];
  modelConfigId: string;
  count?: number;
}
export interface CanvasChatGenerateInput {
  idempotencyKey: string;
  prompt: string;
  modelConfigId: string;
  referenceImageUrls?: string[];
  count?: number;
}
export interface CanvasChatGeneratedImage {
  url: string;
  generationId: string;
  index: number;
  prompt: string;
}
export interface CanvasChatGenerateResponse {
  actionId: string;
  images: CanvasChatGeneratedImage[];
}

const CANVAS_BASE = '/api/canvas-boards';

export const canvasBoardApi = {
  list: () => chatApi.get<CanvasBoardListResponse>(CANVAS_BASE),
  create: (data: { title: string; description?: string }) =>
    chatApi.post<CanvasBoardResponse>(CANVAS_BASE, data),
  get: (id: string) => chatApi.get<CanvasBoardResponse>(`${CANVAS_BASE}/${id}`),
  update: (
    id: string,
    data: { title?: string; description?: string; coverStorageKey?: string; status?: 'active' | 'archived' },
  ) => chatApi.patch<CanvasBoardResponse>(`${CANVAS_BASE}/${id}`, data),
  remove: (id: string) => chatApi.delete(`${CANVAS_BASE}/${id}`),

  getState: (id: string) => chatApi.get<CanvasBoardStateResponse>(`${CANVAS_BASE}/${id}/state`),
  /** PUT with If-Match optimistic concurrency; a 409 carries serverState. */
  saveStateWithVersion: (
    id: string,
    body: { state: CanvasBoardState; createSnapshot?: boolean; thumbnailStorageKey?: string },
    revision: number,
  ) =>
    chatApi.put<CanvasSaveStateResponse>(`${CANVAS_BASE}/${id}/state`, body, {
      headers: { 'If-Match': String(revision) },
    }),
  listVersions: (id: string) =>
    chatApi.get<{ items: CanvasVersionSummary[] }>(`${CANVAS_BASE}/${id}/versions`),
  restoreVersion: (id: string, version: number) =>
    chatApi.post<CanvasSaveStateResponse>(`${CANVAS_BASE}/${id}/versions/${version}/restore`, {}),

  listActions: (id: string, status?: string) =>
    chatApi.get<CanvasAction[]>(`${CANVAS_BASE}/${id}/actions`, { params: status ? { status } : undefined }),
  listRunningActions: (id: string) =>
    chatApi.get<CanvasAction[]>(`${CANVAS_BASE}/${id}/actions`, { params: { status: 'running' } }),
  estimateAction: (id: string, body: CanvasEstimateInput) =>
    chatApi.post<CanvasActionEstimate>(`${CANVAS_BASE}/${id}/actions/estimate`, body),
  generateImage: (id: string, body: CanvasImageGenerateInput) =>
    chatApi.post<CanvasAction>(`${CANVAS_BASE}/${id}/actions/image-generate`, body),
  chatGenerate: (id: string, body: CanvasChatGenerateInput) =>
    chatApi.post<CanvasChatGenerateResponse>(`${CANVAS_BASE}/${id}/actions/chat-generate`, body),
};

export const materialFoldersApi = {
  list: () => chatApi.get<MaterialFolderSidebar>('/api/material-folders'),
  create: (data: { name: string; icon?: string | null }) =>
    chatApi.post<MaterialFolderRow>('/api/material-folders', data),
  update: (id: string, data: { name?: string; sortOrder?: number; icon?: string | null }) =>
    chatApi.patch<MaterialFolderRow>(`/api/material-folders/${id}`, data),
  remove: (id: string) => chatApi.delete(`/api/material-folders/${id}`),
};

// ── Artifacts ────────────────────────────────────────────────────────────
export interface Artifact {
  id: string;
  conversationId: string;
  userId: string;
  title: string;
  type: 'MARKDOWN' | 'CODE' | 'DOCUMENT' | 'TABLE' | 'CHART';
  language?: string;
  content: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions?: ArtifactVersion[];
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  content: string;
  changelog?: string;
  sourcetags: string[];
  sourceMessageId?: string;
  createdAt: string;
}

export const artifactApi = {
  getByConversation: (conversationId: string) =>
    chatApi.get<Artifact>(`/api/artifacts/conversation/${conversationId}`),
  getArtifact: (id: string) => chatApi.get<Artifact>(`/api/artifacts/${id}`),
  updateArtifact: (id: string, content: string, changelog?: string) =>
    chatApi.put<Artifact>(`/api/artifacts/${id}`, { content, changelog }),
  updateTitle: (id: string, title: string) =>
    chatApi.patch<Artifact>(`/api/artifacts/${id}/title`, { title }),
  getVersions: (id: string) => chatApi.get<ArtifactVersion[]>(`/api/artifacts/${id}/versions`),
  revertToVersion: (id: string, version: number) =>
    chatApi.post<Artifact>(`/api/artifacts/${id}/revert/${version}`),
  deleteArtifact: (id: string) => chatApi.delete(`/api/artifacts/${id}`),
};

// ── Marketplace Resources ────────────────────────────────────────────────
export type TemplateStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type ResourceType =
  | 'SKILL'
  | 'MCP'
  | 'AGENT'
  | 'IMAGE_TEMPLATE'
  | 'VIDEO_TEMPLATE';
export type RuntimeReq = 'CLOUD' | 'DESKTOP_ONLY' | 'EITHER';
export type DetectionSrc = 'AUTO' | 'AUTHOR' | 'ADMIN';
export type McpTransport = 'stdio' | 'sse' | 'http';

export type MarketplaceTypeSlug =
  | 'image-templates'
  | 'video-templates'
  | 'skills'
  | 'mcp'
  | 'agents';

export interface TemplateVariable {
  key: string;
  label: string;
  type: string;
  default?: string;
  options?: string[];
}

interface ResourceCommon {
  id: string;
  title: string;
  description?: string;
  category: string;
  coverImage?: string;
  tags: string[];
  version: number;
  pointsCost: number;
  runtimeRequirement: RuntimeReq;
  runtimeDetectedBy: DetectionSrc;
  runtimeReason?: string;
  status: TemplateStatus;
  rejectReason?: string;
  authorId: string;
  useCount: number;
  likeCount: number;
  favoriteCount: number;
  viewCount: number;
  originalUrl?: string;
  authorName?: string;
  authorUrl?: string;
  sourcePlatform?: string;
  externalId?: string;
  externalSlug?: string;
  externalMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ImageTemplate extends ResourceCommon {
  prompt: string;
  variables: TemplateVariable[];
  exampleImages: string[];
  modelHint?: string;
  isHot: boolean;
}

export interface VideoTemplate extends ResourceCommon {
  prompt: string;
  variables: TemplateVariable[];
  exampleMedia: string[];
  modelHint?: string;
  durationSec?: number;
  defaultParams?: {
    ratio?: string;
    resolution?: string;
    generateAudio?: boolean;
    mode?: string;
  };
  materialSlots?: Array<{ role: string; label: string; required: boolean }>;
  isHot: boolean;
}

export interface VideoWorkflowTemplate {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  coverImage?: string | null;
  tags: string[];
  clips: Array<{
    order: number;
    title?: string;
    promptTemplate: string;
    defaultParams: Record<string, unknown>;
    materialSlots?: Array<{
      role: string;
      required: boolean;
      label: string;
      maxCount?: number;
    }>;
    chainFromPrevious: boolean;
  }>;
  pointsCost: number;
  status: TemplateStatus;
  authorId: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoDirectorTemplateContext {
  templateId: string;
  templateKind: 'workflow' | 'standard';
  title: string;
  category?: string | null;
  description?: string | null;
  prompt?: string;
  defaultParams?: Record<string, unknown> | null;
  tags?: string[];
  clips?: Array<{
    order: number;
    title?: string;
    promptTemplate: string;
    defaultParams: Record<string, unknown>;
    chainFromPrevious: boolean;
  }>;
}

export interface Skill extends ResourceCommon {
  rawMarkdown?: string;
  sourceFormat?: string;
  parsedFrontmatter?: Record<string, unknown>;
  instructions: string;
  frontmatter: Record<string, unknown>;
  variables: TemplateVariable[];
  exampleMedia: string[];
  modelHint?: string;
}

export interface McpServer extends ResourceCommon {
  rawConfig?: Record<string, unknown>;
  configFormat?: string;
  serverName: string;
  transport: McpTransport;
  command?: string;
  args: string[];
  envSchema?: Record<string, unknown>;
  headersSchema?: Record<string, unknown>;
  authSchema?: Record<string, unknown>;
  tools?: unknown;
  capabilities?: unknown;
  installNotes?: string;
  securityNotes?: string;
  url?: string;
  exampleMedia: string[];
}

export type AgentKind = 'chat' | 'image' | 'video' | 'avatar';

export type AgentExecutionMode = 'single' | 'workflow';

export interface WorkflowStepDef {
  stepKey: string;
  displayName: string;
  isOptional?: boolean;
  sortOrder: number;
  dependencies?: string[];
  inputArtifactKeys?: string[];
  executorType?: 'deepagent' | 'llm_chain';
  artifactType: string;
  promptTemplate: string;
  toolBindings?: Record<string, unknown>;
  validationSchema?: Record<string, unknown>;
  criticEnabled?: boolean;
  criticPromptTemplate?: string;
  criticPassThreshold?: number;
  maxRefineAttempts?: number;
}

export interface AgentResource extends ResourceCommon {
  kind?: AgentKind;
  systemPrompt: string;
  toolBindings: { mcps?: string[]; skills?: string[] };
  defaultModel?: string;
  variables: TemplateVariable[];
  exampleMedia: string[];
  executionMode?: AgentExecutionMode;
  isSystem?: boolean;
  workflowSteps?: WorkflowStepDef[];
}

export type AnyResource =
  | (ImageTemplate & { resourceType: 'IMAGE_TEMPLATE' })
  | (VideoTemplate & { resourceType: 'VIDEO_TEMPLATE' })
  | (Skill & { resourceType: 'SKILL' })
  | (McpServer & { resourceType: 'MCP' })
  | (AgentResource & { resourceType: 'AGENT' });

// 旧名称别名,沿用既有页面引用
export type PromptTemplate = ImageTemplate;

export interface ImageGeneration {
  id: string;
  templateId: string;
  template?: Pick<ImageTemplate, 'title' | 'coverImage' | 'category' | 'prompt' | 'variables'>;
  userId: string;
  modelUsed: string;
  resolvedPrompt: string;
  variables?: Record<string, string>;
  referenceImage?: string;
  generatedImages: string[];
  status: string;
  error?: string;
  durationMs?: number;
  createdAt: string;
  turns?: GenerationTurn[];
}

export interface VideoGeneration {
  id: string;
  templateId: string;
  template?: Pick<VideoTemplate, 'title' | 'coverImage' | 'category' | 'prompt' | 'variables'>;
  userId: string;
  modelUsed: string;
  resolvedPrompt: string;
  variables?: Record<string, string>;
  referenceImage?: string;
  generatedVideos: string[];
  status: string;
  error?: string;
  durationMs?: number;
  createdAt: string;
  turns?: GenerationTurn[];
}

export type TemplateGeneration = ImageGeneration;

export interface GenerationTurn {
  id: string;
  generationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  images: string[];
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface ListParams {
  category?: string;
  search?: string;
  sort?: 'newest' | 'popular' | 'likes';
  page?: number;
  pageSize?: number;
  authorId?: string;
  status?: TemplateStatus;
}

function makeResourceApi<TResource>(slug: MarketplaceTypeSlug) {
  const base = `/api/marketplace/${slug}`;
  return {
    list: (params?: ListParams) =>
      chatApi.get<PaginatedResult<TResource>>(base, { params }),
    getById: (id: string) => chatApi.get<TResource>(`${base}/${id}`),
    create: (data: Partial<TResource>) => chatApi.post<TResource>(base, data),
    update: (id: string, data: Partial<TResource>) =>
      chatApi.put<TResource>(`${base}/${id}`, data),
    remove: (id: string) => chatApi.delete(`${base}/${id}`),
    like: (id: string) => chatApi.post<{ liked: boolean }>(`${base}/${id}/like`),
    favorite: (id: string) =>
      chatApi.post<{ favorited: boolean }>(`${base}/${id}/favorite`),
    // Plan C Task 10：模板收藏改为显式 POST=favorite / DELETE=unfavorite（不再 POST toggle），
    // 与 gallery 一致。dedicated 路由带公开可见守卫，是模板收藏的唯一正确入口
    // （通用 /resources/:type/:id/favorite 已对模板类型 400，见 resource-metrics.controller）。
    unfavorite: (id: string) =>
      chatApi.delete<{ favorited: boolean }>(`${base}/${id}/favorite`),
  };
}

export const imageTemplateApi = {
  ...makeResourceApi<ImageTemplate>('image-templates'),
  createGeneration: (
    templateId: string,
    data: { modelUsed: string; variables: Record<string, string>; referenceImage?: string },
  ) =>
    chatApi.post<ImageGeneration>(
      `/api/marketplace/image-templates/${templateId}/generations`,
      data,
    ),
};

export const videoTemplateApi = {
  ...makeResourceApi<VideoTemplate>('video-templates'),
  createGeneration: (
    templateId: string,
    data: { modelUsed: string; variables: Record<string, string>; referenceImage?: string },
  ) =>
    chatApi.post<VideoGeneration>(
      `/api/marketplace/video-templates/${templateId}/generations`,
      data,
    ),
};

export const skillApi = makeResourceApi<Skill>('skills');
export const mcpApi = makeResourceApi<McpServer>('mcp');
export const agentApi = makeResourceApi<AgentResource>('agents');

// 旧名称别名,沿用既有页面引用
export const templateApi = imageTemplateApi;

export const imageGenerationApi = {
  getById: (id: string) =>
    chatApi.get<ImageGeneration>(`/api/generations/image/${id}`),
  addTurn: (
    id: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) =>
    chatApi.post<GenerationTurn>(`/api/generations/image/${id}/turns`, data),
  myGenerations: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get<PaginatedResult<ImageGeneration>>('/api/generations/image/my', { params }),
};

export const videoGenerationApi = {
  getById: (id: string) =>
    chatApi.get<VideoGeneration>(`/api/generations/video/${id}`),
  addTurn: (
    id: string,
    data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] },
  ) =>
    chatApi.post<GenerationTurn>(`/api/generations/video/${id}/turns`, data),
  myGenerations: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get<PaginatedResult<VideoGeneration>>('/api/generations/video/my', { params }),
};

export const generationApi = imageGenerationApi;

export interface ImageWorkbenchGenerateInput {
  model: string;
  chatModelId?: string;
  prompt?: string;
  editInstruction?: string;
  sourceImages?: ConversationSourceImage[];
  referenceImages?: ConversationSourceImage[];
  settings?: ConversationImageSettings & Record<string, unknown>;
  visibility?: 'private' | 'public';
}

export interface ImageWorkbenchRefinePromptInput {
  model: string;
  chatModelId?: string;
  prompt: string;
  mode?: 'generate' | 'edit';
  sourceImages?: ConversationSourceImage[];
  referenceImages?: ConversationSourceImage[];
  settings?: ConversationImageSettings & Record<string, unknown>;
}

export interface ImageWorkbenchRefinePromptResult {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  model: string;
  chatModel: string;
  additions: string[];
}

export interface ImageWorkbenchMergeAnnotationInput {
  imageUrl: string;
  overlayDataUrl: string;
}

export interface ImageWorkbenchMergeAnnotationResult {
  image: string;
}

export interface ImageWorkbenchGenerateResult {
  images: Array<{
    url: string;
    prompt?: string;
    generationId?: string;
    index: number;
    sourceImages?: ConversationSourceImage[];
    referenceImages?: ConversationSourceImage[];
  }>;
  prompt: string;
  model: string;
  /**
   * 真正发给上游的参数（`ImageCallResult.applied.params`）。key 由模型 protocol preset
   * 的绑定决定 —— 不是固定字段集，所以带索引签名。`coerced=true` 表示上游组装过程中有
   * 参数被调整/丢弃（`notes` 说明原因），UI 可据此把表单同步成实际生效的值。
   *
   * `kind` 已移除：模型分类（kind 嗅探）连同三个手写 adapter 一起删除了，服务端不再产出它。
   */
  appliedSettings?: {
    size?: string;
    quality?: string;
    count: number;
    coerced: boolean;
    notes: string[];
    [key: string]: unknown;
  };
}

/** 广场作品状态（与后端 GalleryStatus 一致）。 */
export type GalleryPostStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'REMOVED'
  | 'UNPUBLISHED';

/** 该次生成当前「活着的」广场帖（status <> REMOVED, DRAFT）；没有则字段缺省。 */
export interface ImageGenerationGalleryPost {
  id: string;
  status: GalleryPostStatus;
  rejectReason?: string | null;
}

export interface ImageWorkbenchHistoryItem {
  id: string;
  resolvedPrompt: string;
  generatedImages: string[];
  referenceImage?: string | null;
  modelUsed: string;
  modelConfigId?: string | null;
  chatModelId?: string | null;
  status: string;
  durationMs?: number | null;
  createdAt: string;
  images: Array<{
    url: string;
    prompt?: string;
    generationId: string;
    index: number;
    sourceImages?: ConversationSourceImage[];
    referenceImages?: ConversationSourceImage[];
  }>;
  mode?: string;
  settings?: Record<string, unknown>;
  sourceImages?: ConversationSourceImage[];
  referenceImages?: ConversationSourceImage[];
  galleryPost?: ImageGenerationGalleryPost;
}

export interface ImageWorkbenchHistoryResult {
  items: ImageWorkbenchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type PublicImageGenerateInput = ImageWorkbenchGenerateInput;
export type PublicImageGenerateResult = ImageWorkbenchGenerateResult;
export type PublicImageHistoryItem = ImageWorkbenchHistoryItem;
export type PublicImageHistoryResult = ImageWorkbenchHistoryResult;

const IMAGE_WORKBENCH_GENERATE_TIMEOUT_MS = 15 * 60 * 1000;
const IMAGE_WORKBENCH_REFINE_PROMPT_TIMEOUT_MS = 3 * 60 * 1000;

export const imageWorkbenchApi = {
  generate: (data: ImageWorkbenchGenerateInput) =>
    chatApi.post<ImageWorkbenchGenerateResult>('/api/image-gen/workbench/generate', data, {
      timeout: IMAGE_WORKBENCH_GENERATE_TIMEOUT_MS,
    }),
  refinePrompt: (data: ImageWorkbenchRefinePromptInput) =>
    chatApi.post<ImageWorkbenchRefinePromptResult>('/api/image-gen/workbench/refine-prompt', data, {
      timeout: IMAGE_WORKBENCH_REFINE_PROMPT_TIMEOUT_MS,
    }),
  mergeAnnotation: (data: ImageWorkbenchMergeAnnotationInput) =>
    chatApi.post<ImageWorkbenchMergeAnnotationResult>('/api/image-gen/workbench/merge-annotation', data, {
      timeout: IMAGE_WORKBENCH_REFINE_PROMPT_TIMEOUT_MS,
    }),
  history: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get<ImageWorkbenchHistoryResult>('/api/image-gen/workbench/history', { params }),
  deleteHistory: (id: string) =>
    chatApi.delete(`/api/image-gen/workbench/history/${id}`),
};

export const publicImageGeneratorApi = imageWorkbenchApi;

// ── Video Project API ─────────────────────────────────────────────────────
export interface VideoProjectShareClip {
  id: string;
  order: number;
  title: string | null;
  prompt: string | null;
  durationSec: number | null;
}

export interface VideoProjectShareDetail {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  lastFrameUrl: string | null;
  generationId: string;
  model: string;
  totalDurationSec: number;
  clips: VideoProjectShareClip[];
}

export interface VideoProjectShareLinkResult {
  code: string;
}

export const videoProjectApi = {
  create: (data: { title: string; conversationId?: string; coverImage?: string; standalone?: boolean }) =>
    chatApi.post('/api/video-projects', data),
  list: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get('/api/video-projects', { params }),
  getById: (id: string) =>
    chatApi.get(`/api/video-projects/${id}`),
  createShare: (id: string) =>
    chatApi.post<VideoProjectShareLinkResult>(`/api/video-projects/${id}/share`, {}),
  getShared: (code: string) =>
    chatApi.get<VideoProjectShareDetail>(`/api/video-projects/share/${encodeURIComponent(code)}`),
  update: (id: string, data: { title?: string; coverImage?: string }) =>
    chatApi.put(`/api/video-projects/${id}`, data),
  remove: (id: string) =>
    chatApi.delete(`/api/video-projects/${id}`),
  addClip: (projectId: string, data: { title?: string; prompt?: string; params: Record<string, unknown>; chainFromPrev?: boolean }) =>
    chatApi.post(`/api/video-projects/${projectId}/clips`, data),
  updateClip: (projectId: string, clipId: string, data: { title?: string; prompt?: string; params?: Record<string, unknown>; chainFromPrev?: boolean }) =>
    chatApi.put(`/api/video-projects/${projectId}/clips/${clipId}`, data),
  deleteClip: (projectId: string, clipId: string) =>
    chatApi.delete(`/api/video-projects/${projectId}/clips/${clipId}`),
  reorderClips: (projectId: string, clipIds: string[]) =>
    chatApi.put(`/api/video-projects/${projectId}/clips/reorder`, { clipIds }),
  addMaterial: (projectId: string, clipId: string, data: { role: string; sourceType: string; sourceId?: string; url: string; name?: string; metadata?: Record<string, unknown> }) =>
    chatApi.post(`/api/video-projects/${projectId}/clips/${clipId}/materials`, data),
  removeMaterial: (projectId: string, materialId: string) =>
    chatApi.delete(`/api/video-projects/${projectId}/materials/${materialId}`),
  generateClip: (projectId: string, clipId: string, data?: { variantLabel?: string }) =>
    chatApi.post<{ generationId: string; taskId: string }>(
      `/api/video-projects/${projectId}/clips/${clipId}/generate`,
      data ?? {},
    ),
  generateAll: (projectId: string) =>
    chatApi.post<Array<{ generationId: string; taskId: string; clipId: string }>>(
      `/api/video-projects/${projectId}/generate`,
      {},
    ),
  getGenerations: (projectId: string) =>
    chatApi.get<Array<{
      id: string;
      clipId: string;
      projectId: string;
      userId: string;
      status: string;
      seedanceTaskId?: string | null;
      videoUrl?: string | null;
      lastFrameUrl?: string | null;
      thumbnailUrl?: string | null;
      durationSec?: number | null;
      error?: string | null;
      externalStatus?: string | null;
      createdAt: string;
      completedAt?: string | null;
    }>>(`/api/video-projects/${projectId}/generations`),
  refreshGeneration: (projectId: string, generationId: string) =>
    chatApi.post<{
      id: string;
      clipId: string;
      projectId: string;
      userId: string;
      status: string;
      seedanceTaskId?: string | null;
      videoUrl?: string | null;
      lastFrameUrl?: string | null;
      thumbnailUrl?: string | null;
      durationSec?: number | null;
      error?: string | null;
      externalStatus?: string | null;
      createdAt: string;
      completedAt?: string | null;
    }>(`/api/video-projects/${projectId}/generations/${generationId}/refresh`, {}),
  directorChat: (projectId: string, data: {
    message: string;
    modelId?: string;
    templateContext?: VideoDirectorTemplateContext;
    billingPurpose?: 'video_template_optimize' | 'video_storyboard_optimize';
  }) =>
    chatApi.post<{ content: string }>(`/api/video-projects/${projectId}/director-chat`, data, {
      timeout: LLM_REQUEST_TIMEOUT_MS,
    }),
  optimizePrompt: (data: { prompt: string; modelId?: string }) =>
    chatApi.post<{ optimizedPrompt: string }>('/api/video-projects/optimize-prompt', data, {
      timeout: LLM_REQUEST_TIMEOUT_MS,
    }),
  fromImageGenerations: (params?: { page?: number; pageSize?: number; conversationId?: string }) =>
    chatApi.get('/api/video/materials/from-image-generations', { params }),
  fromVideoGenerations: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get('/api/video/materials/from-video-generations', { params }),
  uploadUrl: (data: { fileName: string; contentType: string; folder?: string }) =>
    chatApi.post<{ uploadUrl: string; publicUrl: string; key: string }>(
      '/api/video/materials/upload',
      data,
    ),
  listWorkflowTemplates: (params?: { category?: string; page?: number; pageSize?: number }) =>
    chatApi.get<PaginatedResult<VideoWorkflowTemplate>>('/api/marketplace/video-workflow-templates', { params }),
  getWorkflowTemplate: (id: string) =>
    chatApi.get<VideoWorkflowTemplate>(`/api/marketplace/video-workflow-templates/${id}`),
  createFromTemplate: (templateId: string, data?: { variables?: Record<string, string>; conversationId?: string }) =>
    chatApi.post(`/api/marketplace/video-workflow-templates/${templateId}/create-project`, data ?? {}),
  applyWorkflowTemplate: (projectId: string, templateId: string, data?: { variables?: Record<string, string> }) =>
    chatApi.post(`/api/video-projects/${projectId}/apply-workflow-template/${templateId}`, data ?? {}),
  applyVideoTemplate: (projectId: string, templateId: string, data?: { variables?: Record<string, string> }) =>
    chatApi.post(`/api/video-projects/${projectId}/apply-video-template/${templateId}`, data ?? {}),
};

export interface BatchJob {
  id: string;
  userId: string;
  type: string;
  resourceType: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  total: number;
  processed: number;
  failed: number;
  errorLog: Array<Record<string, unknown>> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

export const batchJobApi = {
  get: (jobId: string) => chatApi.get<BatchJob>(`/api/admin/batch-jobs/${jobId}`),
  list: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get<{ items: BatchJob[]; total: number; page: number; pageSize: number }>(
      '/api/admin/batch-jobs',
      { params },
    ),
};

function makeAdminApi<TResource>(slug: MarketplaceTypeSlug) {
  const base = `/api/admin/${slug}`;
  return {
    list: (params?: { status?: TemplateStatus; page?: number; pageSize?: number }) =>
      chatApi.get<PaginatedResult<TResource>>(base, { params }),
    review: (
      id: string,
      data: { action: 'approve' | 'reject' | 'revise'; reason?: string },
    ) => chatApi.post<TResource>(`${base}/${id}/review`, data),
    overrideRuntime: (
      id: string,
      data: { runtimeRequirement: RuntimeReq; runtimeReason?: string },
    ) => chatApi.patch<TResource>(`${base}/${id}/runtime`, data),
    batchReview: (
      ids: string[],
      action: 'approve' | 'reject' | 'revise',
      reason?: string,
    ) => chatApi.post<{ jobId: string }>(`${base}/batch-review`, { ids, action, reason }),
    batchDelete: (ids: string[]) =>
      chatApi.post<{ jobId: string }>(`${base}/batch-delete`, { ids }),
  };
}

export const imageTemplateAdminApi = {
  ...makeAdminApi<ImageTemplate>('image-templates'),
  setHot: (id: string, isHot: boolean) =>
    chatApi.patch<ImageTemplate>(`/api/admin/image-templates/${id}/hot`, { isHot }),
};
export const videoTemplateAdminApi = {
  ...makeAdminApi<VideoTemplate>('video-templates'),
  setHot: (id: string, isHot: boolean) =>
    chatApi.patch<VideoTemplate>(`/api/admin/video-templates/${id}/hot`, { isHot }),
};
export const skillAdminApi = makeAdminApi<Skill>('skills');
export const mcpAdminApi = makeAdminApi<McpServer>('mcp');
export const agentAdminApi = makeAdminApi<AgentResource>('agents');
export const templateAdminApi = imageTemplateAdminApi;

// ── Marketplace aggregation ──────────────────────────────────────────────
export interface PlatformStats {
  totalResources: number;
  bySkillCount: number;
  byMcpCount: number;
  byAgentCount: number;
  byImageTemplateCount: number;
  byVideoTemplateCount: number;
  totalAcquisitions: number;
}

export interface MarketplaceHome {
  categories: {
    skills: AnyResource[];
    mcp: AnyResource[];
    agents: AnyResource[];
    imageTemplates: AnyResource[];
    videoTemplates: AnyResource[];
  };
  hotRanking: AnyResource[];
  editorPicks: AnyResource[];
  stats: PlatformStats;
}

export const marketplaceApi = {
  home: () => chatApi.get<MarketplaceHome>('/api/marketplace/home'),
  hotRankings: (limit = 10) =>
    chatApi.get<AnyResource[]>('/api/marketplace/hot-rankings', { params: { limit } }),
  editorPicks: (limit = 4) =>
    chatApi.get<AnyResource[]>('/api/marketplace/editor-picks', { params: { limit } }),
  platformStats: () => chatApi.get<PlatformStats>('/api/marketplace/platform-stats'),
};

// ── Resource Metrics / Interactions (统一指标与互动，gallery-design.md §9) ──
// gallery 帖子不属于 marketplace ResourceType，但共用同一套指标/互动接口，
// 因此这里在 marketplace ResourceType 之外单独 union 上 'GALLERY_POST'，
// 不把它加入 marketplace 的 ResourceType（保持 marketplace 映射不变）。
export type MetricResourceType = ResourceType | 'GALLERY_POST';

export interface ResourceMetrics {
  resourceType: MetricResourceType;
  resourceId: string;
  pvCount: number;
  uvCount: number;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  shareCount: number;
  referenceCount: number;
  citationCount: number;
  hotScore: number;
  boostScore: number;
}

export const getResourceMetrics = (type: MetricResourceType, id: string) =>
  chatApi.get<ResourceMetrics>(`/api/resources/${type}/${id}/metrics`);

export const likeResource = (type: MetricResourceType, id: string) =>
  chatApi.post<ResourceMetrics>(`/api/resources/${type}/${id}/like`);

export const unlikeResource = (type: MetricResourceType, id: string) =>
  chatApi.delete<ResourceMetrics>(`/api/resources/${type}/${id}/like`);

export const favoriteResource = (type: MetricResourceType, id: string) =>
  chatApi.post<ResourceMetrics>(`/api/resources/${type}/${id}/favorite`);

export const unfavoriteResource = (type: MetricResourceType, id: string) =>
  chatApi.delete<ResourceMetrics>(`/api/resources/${type}/${id}/favorite`);

export const shareResource = (type: MetricResourceType, id: string) =>
  chatApi.post<ResourceMetrics>(`/api/resources/${type}/${id}/share`);

// ── Public Growth Pages ─────────────────────────────────────────────────
export type PublicCreationMediaType = 'image' | 'video';
export type PublicCollectionKind = 'COMMUNITY' | 'PRESET' | 'VIRAL_PRESET' | 'FEATURE';

export interface PublicGrowthAuthor {
  userId: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  bio?: string | null;
  followerCount?: number;
}

export interface PublicGrowthMediaItem {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  mediaType: PublicCreationMediaType;
  mediaUrl: string;
  posterUrl?: string | null;
  href: string;
  badge?: string | null;
  tags: string[];
  author?: PublicGrowthAuthor | null;
  modelUsed?: string | null;
  prompt?: string | null;
  likeCount?: number;
  viewCount?: number;
  shareCount?: number;
  publishedAt?: string | null;
}

export interface PublicGrowthFeature {
  key: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  mediaUrl?: string;
  accent: string;
}

export interface PublicGrowthCollection {
  slug: string;
  kind: PublicCollectionKind;
  title: string;
  description?: string | null;
  heroMedia?: string | null;
  tags: string[];
}

export interface PublicGrowthPage {
  slug: string;
  title: string;
  description: string;
  heroMedia: string;
  eyebrow?: string;
  ctaHref?: string;
  ctaLabel?: string;
  tags: string[];
  sections: Array<{
    title: string;
    body: string;
    mediaUrl?: string;
    href?: string;
  }>;
}

// ── Acquisitions (Skills/MCP/Agents 一次性获取) ──────────────────────────
export interface UserResourceAcquisition {
  id: string;
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  pointsPaid: number;
  acquiredAt: string;
  resource?: AnyResource;
}

export const acquisitionsApi = {
  acquire: (typeSlug: 'skills' | 'mcp' | 'agents', resourceId: string) =>
    chatApi.post<{
      acquisition: UserResourceAcquisition;
      newBalance: number;
      resource: AnyResource;
    }>(`/api/marketplace/${typeSlug}/${resourceId}/acquire`),
};

// ── /api/me/resources (个人中心) ────────────────────────────────────────
export type MeTab = 'acquired' | 'favorites' | 'published' | 'history' | 'generations';

export const meApi = {
  resources: (tab: MeTab, params?: { page?: number; pageSize?: number }) =>
    chatApi.get<{ items: unknown[]; total?: number; page?: number; pageSize?: number }>(
      '/api/me/resources',
      { params: { tab, ...params } },
    ),
};

// ── Conversation Resources (会话激活) ────────────────────────────────────
export interface ConversationResourceLink {
  id: string;
  conversationId: string;
  resourceType: ResourceType;
  resourceId: string;
  activatedAt: string;
  activatedBy: string;
  resource?: AnyResource;
}

export const conversationResourcesApi = {
  list: (conversationId: string) =>
    chatApi.get<ConversationResourceLink[]>(
      `/api/conversations/${conversationId}/resources`,
    ),
  attach: (
    conversationId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) =>
    chatApi.post<ConversationResourceLink>(
      `/api/conversations/${conversationId}/resources`,
      { resourceType, resourceId },
    ),
  detach: (
    conversationId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) =>
    chatApi.delete(
      `/api/conversations/${conversationId}/resources/${resourceType}/${resourceId}`,
    ),
};

export const storageApi = {
  presign: (data: { fileName: string; contentType: string; folder?: string }) =>
    chatApi.post<{ uploadUrl: string; publicUrl: string; key: string }>(
      '/api/storage/presign',
      data,
    ),
  /**
   * T16: 头像上传 reservation。
   * 返回 `{ uploadUrl, storageKey, publicUrl, expiresAt }`，前端拿到后：
   * 1. PUT uploadUrl 直传 R2
   * 2. 调 `PATCH auth/profile` with `{ avatarStorageKey: storageKey }` 消费 reservation
   */
  presignAvatarUpload: (data: { fileName: string; contentType: string; sizeBytes: number }) =>
    userApi.post<AvatarPresignResult>('/storage/avatar-presign', data),
  /**
   * Profile banner 上传 reservation。与头像同构：拿到 storageKey 后
   * PUT 直传 R2，再 `PATCH auth/profile { bannerStorageKey }` 消费。
   */
  presignBannerUpload: (data: { fileName: string; contentType: string; sizeBytes: number }) =>
    userApi.post<BannerPresignResult>('/storage/banner-presign', data),
};

// ── Membership ──────────────────────────────────────────────────────────
export type {
  MembershipLevel,
  MembershipPlan,
  MembershipInfo,
  PointsBalance,
  PointsRecord,
  PointsPackage,
  AdminMembershipUser,
} from '@autix/domain/billing';

import type {
  MembershipInfo,
  MembershipLevel,
  MembershipPlan,
  UserMembership as DomainUserMembership,
} from '@autix/domain/billing';

export interface UserMembership extends DomainUserMembership {
  level: MembershipLevel;
}

export const membershipApi = {
  getPublicLevels: () => chatApi.get<MembershipLevel[]>('/api/membership/public/levels'),
  getLevels: () =>
    chatApi.get<{ levels: MembershipLevel[]; isFirstTime: boolean }>('/api/membership/levels'),
  getMe: () => chatApi.get<MembershipInfo>('/api/membership/me'),
  cancelAtPeriodEnd: () => chatApi.post<UserMembership>('/api/membership/cancel-at-period-end'),
  createBillingPortal: () => chatApi.post<{ url: string }>('/api/membership/billing-portal'),
};

// ── Points ──────────────────────────────────────────────────────────────
import type {
  PointsBalance,
  PointsRecord,
  PointsPackage,
} from '@autix/domain/billing';

export interface TaskEstimateInput {
  taskType: string;
  modelConfigId?: string;
  params: Record<string, unknown>;
  usage?: Record<string, unknown>;
}

export interface Breakdown {
  id: string;
  op: 'add' | 'mul';
  contribution: number;
  accumulatorAfter: number;
}

export interface TaskEstimateResult {
  estimatedCost: number;
  taskType: string;
  modelConfigId: string;
  breakdown: Breakdown[];
  pricingSnapshot: Record<string, unknown>;
}

export interface TaskDefinition {
  id: string;
  taskType: string;
  name: string;
  category: 'chat' | 'image' | 'video' | 'prompt';
  isActive: boolean;
  sort: number;
}

export interface TaskModel {
  modelConfigId: string;
  name: string;
  provider: string;
  isDefault: boolean;
  description: string;
  paramsSchema: Record<string, unknown>;
  pricingSchema: Record<string, unknown>;
  multiplier: number;
  discountFactor: number;
}

export interface QuoteTaskResult {
  total: number;
  breakdown: Breakdown[];
}

export interface PointGrantBatch {
  id: string;
  grantType: 'SUBSCRIPTION' | 'PURCHASED' | 'GIFT' | 'COMPENSATION';
  sourceEvent: string;
  sourceId: string | null;
  totalAmount: number;
  availableAmount: number;
  frozenAmount: number;
  consumedAmount: number;
  expiredAmount: number;
  refundedAmount: number;
  expiresAt: string | null;
  usageScope: Record<string, unknown> | null;
  createdAt: string;
}

export interface PointAccountSummary {
  account: PointsBalance;
  grants: PointGrantBatch[];
  balances: {
    available: number;
    frozen: number;
    total: number;
    subscription: number;
    purchased: number;
    gift: number;
    compensation: number;
  };
}

export const pointsApi = {
  getBalance: () => chatApi.get<PointsBalance>('/api/points/balance'),
  getSummary: () => chatApi.get<PointAccountSummary>('/api/points/summary'),
  getRecords: (params?: { page?: number; pageSize?: number; source?: string }) =>
    chatApi.get<PaginatedResult<PointsRecord>>('/api/points/records', { params }),
  getPackages: () => chatApi.get<PointsPackage[]>('/api/points/packages'),
  estimate: (data: TaskEstimateInput) =>
    chatApi.post<TaskEstimateResult>('/api/points/estimate', data),
};

export const tasksApi = {
  listTasks: () => chatApi.get<TaskDefinition[]>('/api/tasks'),
  listModels: (taskType: string) =>
    chatApi.get<TaskModel[]>(`/api/tasks/${taskType}/models`),
  quote: (taskType: string, input: { modelConfigId?: string; params: Record<string, unknown>; usage?: Record<string, unknown> }) =>
    chatApi.post<QuoteTaskResult>(`/api/tasks/${taskType}/quote`, input),
};

// ── Campaign Rewards ────────────────────────────────────────────────────
export type CampaignType = 'CONTINUOUS_USE' | 'INVITATION' | 'FEEDBACK' | 'REGISTRATION' | 'QUEST' | 'CUSTOM';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: CampaignType;
  status: CampaignStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  dailyBudget?: number | null;
  totalBudget?: number | null;
  usedBudget: number;
  perUserDailyCap?: number | null;
  perUserTotalCap?: number | null;
  rewardGrantType: 'SUBSCRIPTION' | 'PURCHASED' | 'GIFT' | 'COMPENSATION';
  rewardSourceEvent: string;
  rewardPointsExpression?: Record<string, unknown> | number | null;
  rewardExpiresInDays: number;
  rewardUsageScope?: Record<string, unknown> | null;
  eligibility?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { rewards: number };
}

export interface CampaignReward {
  id: string;
  campaignId: string;
  campaign?: Campaign;
  userId: string;
  triggerKey: string;
  triggerEventId?: string | null;
  pointsGranted: number;
  pointGrantId?: string | null;
  grantedAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface UserActivityStreak {
  id: string;
  userId: string;
  streakType: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string | null;
  rewardedAtCycle?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignProgress {
  activeCampaigns: Campaign[];
  homeStarterTasks?: HomeStarterTask[];
  claimableCampaigns?: HomeStarterTask[];
  streaks: UserActivityStreak[];
  rewards: CampaignReward[];
  pendingInvites: Array<{
    id: string;
    inviteCodeId: string;
    inviterUserId: string;
    inviteeUserId: string;
    rewardPoints: number;
    rewarded: boolean;
    createdAt: string;
  }>;
}

export interface CampaignFeedbackInput {
  feedbackId?: string | null;
  generationId?: string | null;
  generationType?: string | null;
  rating?: number | null;
  tags?: string[] | null;
  text?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CampaignFeedbackResult {
  status: 'recorded' | 'no_active_campaign';
  rewards: Array<{
    status: 'granted' | 'duplicate';
    reward: CampaignReward;
  }>;
}

export type HomeStarterTaskStatus = 'LOCKED' | 'CLAIMABLE' | 'CLAIMED' | 'DISABLED';

export interface HomeStarterTask {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  points: number;
  status: HomeStarterTaskStatus;
  completed: boolean;
  titleI18nKey: string;
  subtitleI18nKey: string;
  ctaI18nKey: string;
  modelLabel: string;
  hrefPath: string;
  sortOrder: number;
}

export interface HomeStarterTasksResult {
  items: HomeStarterTask[];
  summary: {
    total: number;
    completed: number;
    availablePoints: number;
  };
}

export interface HomeStarterClaimResult {
  status: 'granted' | 'claimed';
  reward?: CampaignReward;
  task?: HomeStarterTask | null;
}

export interface UpsertCampaignInput {
  code?: string;
  name?: string;
  description?: string | null;
  type?: CampaignType;
  status?: CampaignStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  dailyBudget?: number | null;
  totalBudget?: number | null;
  perUserDailyCap?: number | null;
  perUserTotalCap?: number | null;
  rewardGrantType?: 'SUBSCRIPTION' | 'PURCHASED' | 'GIFT' | 'COMPENSATION';
  rewardSourceEvent?: string;
  rewardPoints?: number;
  rewardPointsExpression?: Record<string, unknown> | number | null;
  rewardExpiresInDays?: number;
  rewardUsageScope?: Record<string, unknown> | null;
  eligibility?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export const campaignApi = {
  getActive: () => chatApi.get<Campaign[]>('/api/campaigns/active'),
  getMyProgress: () => chatApi.get<CampaignProgress>('/api/campaigns/me/progress'),
  getHomeStarterTasks: () =>
    chatApi.get<HomeStarterTasksResult>('/api/campaigns/home-starter'),
  claimHomeStarterTask: (code: string) =>
    chatApi.post<HomeStarterClaimResult>(
      `/api/campaigns/home-starter/${encodeURIComponent(code)}/claim`,
    ),
  submitFeedback: (data: CampaignFeedbackInput) =>
    chatApi.post<CampaignFeedbackResult>('/api/campaigns/feedback', data),
};

// ── Orders ──────────────────────────────────────────────────────────────
export interface Order {
  id: string;
  userId: string;
  orderNo: string;
  orderType: 'MEMBERSHIP' | 'POINTS_PACKAGE';
  businessType?: 'subscription_order' | 'points_order' | 'renewal_order' | 'upgrade_order' | 'refund_order' | null;
  productId: string;
  productName: string;
  originalPrice: string;
  amount: string;
  isFirstTime: boolean;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  paymentProvider?: string | null;
  externalPaymentId?: string | null;
  paymentEventId?: string | null;
  paidAmount?: string | null;
  currency?: string | null;
  refundProvider?: string | null;
  externalRefundId?: string | null;
  refundAmount?: string | null;
  refundReason?: string | null;
  paidAt: string | null;
  fulfilledAt?: string | null;
  refundedAt?: string | null;
  createdAt: string;
}

export interface StripeCheckoutResult {
  order: Order;
  checkoutUrl: string | null;
  sessionId: string | null;
  freeFulfilled?: boolean;
}

export interface StripeCheckoutSyncResult {
  order: Order;
  sessionId: string;
  paymentStatus?: string | null;
  sessionStatus?: string | null;
  synced: boolean;
}

export const orderApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    orderType?: string;
  }) => chatApi.get<PaginatedResult<Order>>('/api/orders', { params }),
  getById: (id: string) => chatApi.get<Order>(`/api/orders/${id}`),
  createStripeCheckout: (data: { orderType: Order['orderType']; productId: string }) =>
    chatApi.post<StripeCheckoutResult>('/api/orders/checkout/stripe', data),
  syncStripeCheckout: (data: { sessionId: string }) =>
    chatApi.post<StripeCheckoutSyncResult>('/api/orders/checkout/stripe/sync', data),
  createStripeCheckoutForOrder: (id: string) =>
    chatApi.post<StripeCheckoutResult>(`/api/orders/${id}/checkout/stripe`),
  cancel: (id: string) => chatApi.post<Order>(`/api/orders/${id}/cancel`),
};

// ── Invite ──────────────────────────────────────────────────────────────
export interface InviteCode {
  id: string;
  userId: string;
  code: string;
  createdAt: string;
}

export interface InviteRecord {
  id: string;
  inviteCodeId: string;
  inviterUserId: string;
  inviteeUserId: string;
  rewardPoints: number;
  rewarded: boolean;
  createdAt: string;
}

export const inviteApi = {
  getCode: () => chatApi.get<InviteCode | null>('/api/invite/code'),
  getRecords: () => chatApi.get<InviteRecord[]>('/api/invite/records'),
};

// ── Membership Admin ────────────────────────────────────────────────────
export const membershipAdminApi = {
  getLevels: () => chatApi.get<MembershipLevel[]>('/api/admin/membership/levels'),
  createLevel: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/membership/levels', data),
  updateLevel: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/membership/levels/${id}`, data),
  deleteLevel: (id: string) =>
    chatApi.delete(`/api/admin/membership/levels/${id}`),

  getPlans: () => chatApi.get<MembershipPlan[]>('/api/admin/membership/plans'),
  createPlan: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/membership/plans', data),
  updatePlan: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/membership/plans/${id}`, data),
  deletePlan: (id: string) =>
    chatApi.delete(`/api/admin/membership/plans/${id}`),

  getPackages: () => chatApi.get<PointsPackage[]>('/api/admin/points/packages'),
  createPackage: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/points/packages', data),
  updatePackage: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/points/packages/${id}`, data),
  deletePackage: (id: string) =>
    chatApi.delete(`/api/admin/points/packages/${id}`),

  getOrders: (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: string;
    orderType?: string;
  }) => chatApi.get<PaginatedResult<Order>>('/api/admin/orders', { params }),
  fulfillOrder: (
    id: string,
    data?: {
      confirm: 'CONFIRM_MANUAL_FULFILL';
      externalPaymentId?: string;
      amount?: string | number;
      currency?: string;
      remark?: string;
    },
  ) => chatApi.post(`/api/admin/orders/${id}/fulfill`, data ?? {}),
  refundOrder: (
    id: string,
    data?: {
      confirm: 'CONFIRM_REFUND';
      externalRefundId?: string;
      amount?: string | number;
      currency?: string;
      reclaimPoints?: boolean;
      maxPointsToReclaim?: number;
      reason?: string;
      remark?: string;
    },
  ) => chatApi.post(`/api/admin/orders/${id}/refund`, data ?? {}),

  getPointsRecords: (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    source?: string;
  }) => chatApi.get<PaginatedResult<PointsRecord>>('/api/admin/points/records', { params }),

  getUsers: (params?: { page?: number; pageSize?: number; search?: string }) =>
    chatApi.get<PaginatedResult<unknown>>('/api/admin/users', { params }),

  getUserDetail: (userId: string) => chatApi.get<unknown>(`/api/admin/users/${userId}`),

  // P2-C-1: 接入后端 P2-A1 用户积分聚合接口（账户 / 在用批次 / 冻结中 / 近期流水）
  getUserPointsDetail: (
    userId: string,
    params?: { grantTake?: number; holdTake?: number; recordTake?: number },
  ) =>
    chatApi.get<AdminUserPointsDetail>(
      `/api/admin/users/${userId}/points-detail`,
      { params },
    ),

  grantMembership: (userId: string, data: { levelId: string; months?: number }) =>
    chatApi.post(`/api/admin/users/${userId}/grant-membership`, data),

  grantPoints: (
    userId: string,
    data: { points?: number; remark?: string; packageId?: string },
  ) => chatApi.post(`/api/admin/users/${userId}/grant-points`, data),

  approveUser: (userId: string, data?: { note?: string }) =>
    chatApi.post(`/api/admin/users/${userId}/approve`, data ?? {}),

  // P2-C-1: 接入后端 P2-A2 审计日志查询（内存 ring buffer）
  getAuditLogs: (params?: {
    action?: string;
    actorId?: string;
    limit?: number;
    cursor?: number;
  }) =>
    chatApi.get<AdminAuditLogPage>('/api/admin/audit-logs', { params }),

  getCampaigns: () => chatApi.get<Campaign[]>('/api/admin/campaigns'),
  createCampaign: (data: UpsertCampaignInput) =>
    chatApi.post<Campaign>('/api/admin/campaigns', data),
  updateCampaign: (id: string, data: UpsertCampaignInput) =>
    chatApi.put<Campaign>(`/api/admin/campaigns/${id}`, data),
  getCampaignRewards: (id: string, params?: { take?: number }) =>
    chatApi.get<CampaignReward[]>(`/api/admin/campaigns/${id}/rewards`, { params }),
  grantCampaignOnce: (id: string, data: { userId: string }) =>
    chatApi.post(`/api/admin/campaigns/${id}/grant-once`, data),
};

// ===== 风控与用户管理（R3） =====

export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface RiskUserBasic {
  id: string;
  username?: string | null;
  email?: string | null;
  status?: string | null;
  createdAt?: string | null;
  signupIp?: string | null;
  signupDeviceId?: string | null;
}

export interface RiskUserListItem {
  user: RiskUserBasic;
  level: RiskLevel;
  score: number;
  topSignals?: string[] | null;
  inviter: RiskUserBasic | null;
  inviteCount: number;
}

export interface RiskUserListResult {
  items: RiskUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RiskEvent {
  id: string;
  type: string;
  severity: number;
  detail?: unknown;
  actorId?: string | null;
  createdAt: string;
}

export interface RiskInvitee {
  inviteeUserId: string;
  rewarded: boolean;
  createdAt: string;
  invitee: RiskUserBasic | null;
}

export interface RiskUserDetail {
  profile: { userId: string; level: RiskLevel; score: number; manualOverride?: boolean; user?: RiskUserBasic };
  inviter: RiskUserBasic | null;
  invitees: RiskInvitee[];
  inviteCount: number;
  events: RiskEvent[];
}

export const riskAdminApi = {
  listUsers: (params?: { level?: string; page?: number; pageSize?: number }) =>
    chatApi.get<RiskUserListResult>('/api/admin/risk/users', { params }),
  getUser: (id: string) => chatApi.get<RiskUserDetail>(`/api/admin/risk/users/${id}`),
  setLevel: (id: string, data: { level: RiskLevel; reason?: string }) =>
    chatApi.post(`/api/admin/risk/users/${id}/level`, data),
  block: (id: string, data?: { reason?: string }) =>
    chatApi.post(`/api/admin/risk/users/${id}/block`, data ?? {}),
  unblock: (id: string, data?: { reason?: string }) =>
    chatApi.post(`/api/admin/risk/users/${id}/unblock`, data ?? {}),
};

/** 作者展示身份（已注销用户由服务端 presentAuthor 脱敏：昵称占位、头像置空）。 */
export interface GalleryAuthor {
  userId: string;
  nickname: string;
  avatar: string | null;
}

// ── Gallery Admin (广场审核) ─────────────────────────────────────────────
export interface GalleryPostAdminItem {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  title: string | null;
  coverImage: string | null;
  mediaUrls: string[];
  category: string;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN' | 'REMOVED';
  author: GalleryAuthor;
  createdAt: string;
  publishedAt: string | null;
  sourceType: 'USER_UPLOAD' | 'FROM_GENERATION' | 'FROM_TEMPLATE' | 'ADMIN_CURATED';
}

export type GalleryAdminStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REJECTED';
export type GalleryAdminKind = 'IMAGE' | 'VIDEO';
export type GalleryAdminSourceType =
  | 'USER_UPLOAD'
  | 'FROM_GENERATION'
  | 'FROM_TEMPLATE'
  | 'ADMIN_CURATED';

export interface GalleryAdminListParams {
  status?: GalleryAdminStatus;
  kind?: GalleryAdminKind;
  category?: string;
  sourceType?: GalleryAdminSourceType;
  search?: string;
  /** 仅显示非我域名（未托管到自有 R2）的作品 */
  externalOnly?: boolean;
  /** 仅显示搬运失败（已达重试上限、worker 已止损）的作品 */
  migrationFailed?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GalleryAdminListResult {
  items: GalleryPostAdminItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type GalleryBatchAction = 'approve' | 'reject' | 'hide' | 'remove';

export interface GalleryBatchResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

function galleryAdminListQuery(params: GalleryAdminListParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (params.status) q.status = params.status;
  if (params.kind) q.kind = params.kind;
  if (params.category) q.category = params.category;
  if (params.sourceType) q.sourceType = params.sourceType;
  if (params.search) q.search = params.search;
  if (params.externalOnly) q.externalOnly = 'true';
  if (params.migrationFailed) q.migrationFailed = 'true';
  if (params.page) q.page = String(params.page);
  if (params.pageSize) q.pageSize = String(params.pageSize);
  return q;
}

export const galleryAdminApi = {
  list: (params: GalleryAdminListParams = {}) =>
    chatApi.get<GalleryAdminListResult>('/api/admin/gallery', {
      params: galleryAdminListQuery(params),
    }),
  listCategories: () => chatApi.get<string[]>('/api/admin/gallery/categories'),
  approve: (id: string) =>
    chatApi.post<GalleryPostAdminItem>(`/api/admin/gallery/${id}/approve`, {}),
  reject: (id: string, reason: string) =>
    chatApi.post<GalleryPostAdminItem>(`/api/admin/gallery/${id}/reject`, { reason }),
  hide: (id: string) =>
    chatApi.post<GalleryPostAdminItem>(`/api/admin/gallery/${id}/hide`, {}),
  remove: (id: string) =>
    chatApi.post<GalleryPostAdminItem>(`/api/admin/gallery/${id}/remove`, {}),
  resolveReport: (reportId: string, status: 'RESOLVED' | 'DISMISSED') =>
    chatApi.post(`/api/admin/gallery/reports/${reportId}/resolve`, { status }),
  batch: (ids: string[], action: GalleryBatchAction, reason?: string) =>
    chatApi.post<GalleryBatchResult>('/api/admin/gallery/batch', { ids, action, reason }),
  importGallery: (items: Record<string, any>[]) =>
    chatApi.post<{ jobId: string }>('/api/admin/gallery/import', { items }),
};

// ── Gallery 公开热度 Feed (首页图片/视频画廊消费) ───────────────────────────
export interface GalleryFeedPost {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  title: string | null;
  description: string | null;
  category: string;
  tags: string[];
  coverImage: string | null;
  mediaUrls: string[];
  aspectRatio: string | null;
  durationSec: number | null;
  prompt: string | null;
  /** 厂商模型串（`doubao-seedream-4-5`）。留作数据，不直接展示给用户。 */
  model: string | null;
  /** 展示用的模型别名（`Seedream 4.5`），由服务端查 model_configs 解析；解析不到为 null。 */
  modelName: string | null;
  width: number | null;
  height: number | null;
  authorId: string;
  publishedAt: string | null;
}

export interface GalleryFeedItem {
  post: GalleryFeedPost;
  /** 与 GET /gallery/:id 详情同一形状——feed 不再自造 authorSnapshot。 */
  author: GalleryAuthor;
  metrics: {
    pvCount: number;
    uvCount: number;
    likeCount: number;
    favoriteCount: number;
    viewCount: number;
    referenceCount: number;
  };
  /** Plan C Task 8：登录态附本页每项的 viewer 态；匿名访问时省略（不是 false，是 undefined）。 */
  liked?: boolean;
  favorited?: boolean;
}

export interface GalleryFeedResult {
  items: GalleryFeedItem[];
  nextCursor: string | null;
}

// ── Gallery 详情 / 发布 / 下架 / recreate / download (Task 12 前端接线) ─────────

export type GallerySourceTypeInput = 'USER_UPLOAD' | 'FROM_GENERATION' | 'FROM_TEMPLATE';

/** POST /gallery 请求体：先审后发投稿。FROM_GENERATION 的 mediaUrls/coverImage 由服务端从生成记录派生，无需携带。 */
export interface CreateGalleryPostInput {
  kind: 'IMAGE' | 'VIDEO';
  title?: string;
  description?: string;
  /** 可选：不传则落 ''，由审核员在管理端补分类（分类只用于管理端筛选）。 */
  category?: string;
  tags?: string[];
  coverImage?: string;
  mediaUrls?: string[];
  aspectRatio?: string;
  durationSec?: number;
  sourceType: GallerySourceTypeInput;
  imageTemplateId?: string;
  videoTemplateId?: string;
  imageGenerationId?: string;
  videoGenerationId?: string;
  /** FROM_GENERATION 投稿时是否允许把生成参考图一并公开快照，见后端 CreateGalleryPostDto。 */
  allowPublicReference?: boolean;
}

/**
 * gallery_posts 全字段（不含 author 关联行）——POST /gallery、POST /gallery/:id/{unpublish,republish}
 * 均直接回这条原始行（repo.create / repo.update 的结果），与 GalleryPostAdminItem（管理端裁剪视图）不同。
 */
export interface GalleryDetailPost {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  title: string | null;
  description: string | null;
  category: string;
  tags: string[];
  coverImage: string | null;
  mediaUrls: string[];
  aspectRatio: string | null;
  durationSec: number | null;
  prompt: string | null;
  model: string | null;
  /** 展示用的模型别名（服务端查 model_configs 解析）；解析不到为 null。 */
  modelName: string | null;
  width: number | null;
  height: number | null;
  referenceImage: string | null;
  sourceType: GallerySourceTypeInput | 'ADMIN_CURATED';
  imageTemplateId: string | null;
  videoTemplateId: string | null;
  imageGenerationId: string | null;
  videoGenerationId: string | null;
  status: GalleryAdminStatus | 'DRAFT' | 'UNPUBLISHED';
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  isFeatured: boolean;
  isPinned: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

/** GET /gallery/:id 详情聚合里的作者：presentAuthor 脱敏结果（已注销用户不回传 username/PII）。 */
export interface GalleryDetailAuthor {
  userId: string;
  nickname: string;
  avatar: string | null;
}

export interface GalleryDetailMetrics {
  pvCount: number;
  uvCount: number;
  viewCount: number;
  downloadCount: number;
  referenceCount: number;
  likeCount: number;
  favoriteCount: number;
}

export interface GalleryDetailResult {
  post: GalleryDetailPost;
  author: GalleryDetailAuthor;
  metrics: GalleryDetailMetrics;
  /** 仅登录态返回；匿名详情省略该字段。 */
  viewer?: { liked: boolean; favorited: boolean };
}

export interface GalleryRecreateResult {
  prompt: string | null;
  model: string | null;
  /** null 时不含该字段（brief 约定），非引用授权/无参考图时同样不返回。 */
  referenceImage?: string;
}

export const galleryApi = {
  /** GET /api/gallery/feed?kind=IMAGE|VIDEO —— 公开，只返回已发布(PUBLISHED)作品。 */
  feed: (params?: { kind?: 'IMAGE' | 'VIDEO'; cursor?: string; limit?: number }) =>
    chatApi.get<GalleryFeedResult>('/api/gallery/feed', { params }),
  /** GET /api/gallery/feed 的别名，命名对齐 Task 12 brief 的 galleryApi.getFeed。 */
  getFeed: (params?: { kind?: 'IMAGE' | 'VIDEO'; cursor?: string; limit?: number }) =>
    chatApi.get<GalleryFeedResult>('/api/gallery/feed', { params }),
  /** GET /api/gallery/:id —— 公开详情聚合（匿名仅 PUBLISHED；作者/管理员可预览非公开态）。 */
  getDetail: (id: string) => chatApi.get<GalleryDetailResult>(`/api/gallery/${id}`),
  /** POST /api/gallery —— 先审后发投稿（直接进 PENDING，非直接可见）。 */
  publish: (data: CreateGalleryPostInput) =>
    chatApi.post<GalleryDetailPost>('/api/gallery', data),
  /** POST /api/gallery/:id/unpublish —— 作者本人下架已发布作品，PUBLISHED → UNPUBLISHED。 */
  unpublish: (id: string) =>
    chatApi.post<GalleryDetailPost>(`/api/gallery/${id}/unpublish`, {}),
  /** POST /api/gallery/:id/republish —— 作者本人把已下架作品重新提交审核，UNPUBLISHED → PENDING。 */
  republish: (id: string) =>
    chatApi.post<GalleryDetailPost>(`/api/gallery/${id}/republish`, {}),
  /** DELETE /api/gallery/:id —— 作者本人删除自己的作品（→ REMOVED）。
   *  PENDING=撤回投稿；REJECTED/UNPUBLISHED/HIDDEN=彻底删除。PUBLISHED 需先 unpublish。 */
  remove: (id: string) => chatApi.delete<GalleryDetailPost>(`/api/gallery/${id}`),
  /** POST /api/gallery/:id/recreate —— 仅已发布作品；返回该作品创作快照并记一次引用。 */
  recreate: (id: string) => chatApi.post<GalleryRecreateResult>(`/api/gallery/${id}/recreate`, {}),
  /** POST /api/gallery/:id/download —— 仅已发布作品；同步记一次下载事件 + INCR downloadCount。 */
  download: (id: string) => chatApi.post<{ downloadUrl: string }>(`/api/gallery/${id}/download`, {}),
  // Plan C Task 10：Gallery 的专属受守卫互动路由（仅 PUBLISHED 可点赞/收藏；favorite 经
  // FavoriteLibraryService 单事务耦合）。like/unlike 为显式 POST/DELETE，返回完整指标；
  // favorite/unfavorite 为显式 POST/DELETE，返回 { favorited }。通用 /resources 端点已对
  // GALLERY_POST 返回 400，故这些专属路由是 Gallery 互动的唯一正确入口（供 Task 12 详情视图接入）。
  like: (id: string) => chatApi.post<ResourceMetrics>(`/api/gallery/${id}/like`),
  unlike: (id: string) => chatApi.delete<ResourceMetrics>(`/api/gallery/${id}/like`),
  favorite: (id: string) =>
    chatApi.post<{ favorited: boolean }>(`/api/gallery/${id}/favorite`),
  unfavorite: (id: string) =>
    chatApi.delete<{ favorited: boolean }>(`/api/gallery/${id}/favorite`),
};

// ── Public Profile (`/@username` 公开个人页) ─────────────────────────────
export const publicProfileApi = {
  /** GET /api/profiles/:username —— 公开个人页基础信息（匿名可读；用户不存在/已注销 404）。 */
  getByUsername: (username: string) =>
    chatApi.get<PublicProfile>(`/api/profiles/${encodeURIComponent(username)}`),
  /**
   * GET /api/profiles/:username/generations —— 该用户已发布作品 feed（image+video 混排）。
   * 匿名可读；登录态附每项 liked/favorited。响应与 gallery feed 同形（GalleryFeedResult）。
   */
  getGenerations: (
    username: string,
    params?: { cursor?: string; limit?: number },
  ) =>
    chatApi.get<GalleryFeedResult>(
      `/api/profiles/${encodeURIComponent(username)}/generations`,
      { params },
    ),
};

// ── Telemetry (PV/UV 浏览上报) ───────────────────────────────────────────
/** 单条浏览事件。userId/visitorId 由前端携带（后端 @Public，从 body 读身份做 PV/UV 去重）。 */
export interface ResourceViewEventInput {
  resourceType: string;
  resourceId: string;
  scope: 'list' | 'detail' | 'hero';
  userId?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
}

export const telemetryApi = {
  /**
   * POST /api/telemetry/resource-view —— 批量上报浏览事件（@Public，best-effort）。
   * 后端写明细表（按分钟/天 insert-or-ignore），cron 每 10min 聚合进 resource_metrics。
   */
  reportResourceViews: (events: ResourceViewEventInput[]) =>
    chatApi.post<{ accepted: number }>('/api/telemetry/resource-view', events),
};

// ── Featured Slots Admin (运营位编排) ────────────────────────────────────
export type FeaturedSlotKind = 'RESOURCE' | 'CUSTOM';

/** 候选资源检索仅支持这三类来源表（模板 / 广场作品）。 */
export type FeaturedSlotCandidateResourceType =
  | 'IMAGE_TEMPLATE'
  | 'VIDEO_TEMPLATE'
  | 'GALLERY_POST';

export interface FeaturedSlot {
  id: string;
  placement: string;
  kind: FeaturedSlotKind;
  resourceType: MetricResourceType | null;
  resourceId: string | null;
  overrideTitle: string | null;
  overrideDescription: string | null;
  overrideCoverImage: string | null;
  overrideCoverVideo: string | null;
  overrideCtaText: string | null;
  overrideCtaHref: string | null;
  position: number;
  isEnabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface FeaturedSlotCandidate {
  id: string;
  title: string;
}

export interface CreateFeaturedSlotInput {
  placement: string;
  kind: FeaturedSlotKind;
  resourceType?: MetricResourceType | null;
  resourceId?: string | null;
  overrideTitle?: string | null;
  overrideDescription?: string | null;
  overrideCoverImage?: string | null;
  overrideCoverVideo?: string | null;
  overrideCtaText?: string | null;
  overrideCtaHref?: string | null;
  position?: number;
  isEnabled?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export type UpdateFeaturedSlotInput = Partial<
  Omit<CreateFeaturedSlotInput, 'placement' | 'position'>
>;

export const featuredSlotsAdminApi = {
  list: (placement: string) =>
    chatApi.get<FeaturedSlot[]>('/api/admin/featured-slots', { params: { placement } }),
  candidates: (resourceType: FeaturedSlotCandidateResourceType, query?: string) =>
    chatApi.get<FeaturedSlotCandidate[]>('/api/admin/featured-slots/candidates', {
      params: { resourceType, query },
    }),
  create: (data: CreateFeaturedSlotInput) =>
    chatApi.post<FeaturedSlot>('/api/admin/featured-slots', data),
  update: (id: string, data: UpdateFeaturedSlotInput) =>
    chatApi.patch<FeaturedSlot>(`/api/admin/featured-slots/${id}`, data),
  remove: (id: string) => chatApi.delete(`/api/admin/featured-slots/${id}`),
  reorder: (placement: string, orderedIds: string[]) =>
    chatApi.patch<FeaturedSlot[]>('/api/admin/featured-slots/reorder', {
      placement,
      orderedIds,
    }),
};

// ── Resource Boost Admin (内容加热) ──────────────────────────────────────
export type BoostReason = 'MANUAL' | 'CAMPAIGN' | 'EDITORIAL_PICK' | 'CORRECTION';

export interface ResourceBoostAdminItem {
  id: string;
  resourceType: MetricResourceType;
  resourceId: string;
  boostScore: number;
  reason: BoostReason;
  note: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isCurrentlyActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBoostInput {
  boostScore: number;
  reason?: BoostReason;
  note?: string | null;
  startsAt?: string;
  endsAt: string;
}

export interface UpdateBoostInput {
  boostScore?: number;
  reason?: BoostReason;
  note?: string | null;
  startsAt?: string;
  endsAt?: string;
}

export const boostAdminApi = {
  list: (params?: { type?: MetricResourceType; query?: string }) =>
    chatApi.get<ResourceBoostAdminItem[]>('/api/admin/resources/boosts', { params }),
  create: (resourceType: MetricResourceType, resourceId: string, data: CreateBoostInput) =>
    chatApi.post<ResourceBoostAdminItem>(
      `/api/admin/resources/${resourceType}/${resourceId}/boost`,
      data,
    ),
  update: (id: string, data: UpdateBoostInput) =>
    chatApi.patch<ResourceBoostAdminItem>(`/api/admin/resources/boosts/${id}`, data),
  revoke: (id: string) => chatApi.delete(`/api/admin/resources/boosts/${id}`),
};

// P2-C-1: 与后端 AdminAuditStore 返回结构保持一致
export interface AdminAuditEntry {
  id: number;
  action: string;
  actorId: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface AdminAuditLogPage {
  items: AdminAuditEntry[];
  total: number;
  nextCursor: number | null;
}

// P2-C-1: 与后端 AdminController.getUserPointsDetail 返回结构保持一致
export interface AdminPointGrantSummary {
  grantType: string;
  _sum: {
    totalAmount: number | null;
    availableAmount: number | null;
    frozenAmount: number | null;
    consumedAmount: number | null;
    expiredAmount: number | null;
    refundedAmount: number | null;
  };
}

export interface AdminPointHoldSummary {
  status: string;
  _count: { _all: number };
  _sum: {
    estimatedAmount: number | null;
    confirmedAmount: number | null;
  };
}

export interface AdminUserPointsDetail {
  userId: string;
  account: {
    userId: string;
    balance: number;
    frozen?: number;
    updatedAt?: string;
  } | null;
  grantSummary: AdminPointGrantSummary[];
  holdSummary: AdminPointHoldSummary[];
  grants: Array<{
    id: string;
    grantType: string;
    source: string;
    sourceId?: string | null;
    totalAmount: number;
    availableAmount: number;
    frozenAmount: number;
    consumedAmount: number;
    expiredAmount: number;
    refundedAmount: number;
    expiresAt?: string | null;
    createdAt: string;
    usageScope?: unknown;
    remark?: string | null;
  }>;
  holds: Array<{
    id: string;
    status: string;
    taskType?: string | null;
    estimatedAmount: number;
    confirmedAmount?: number | null;
    createdAt: string;
    updatedAt?: string;
    items?: Array<{
      id: string;
      grantId: string;
      amount: number;
    }>;
  }>;
  records: PointsRecord[];
}

// ── Agent Run API ──────────────────────────────────────────────────────
export const agentRunApi = {
  getActive: (conversationId: string) =>
    chatApi.get(`/api/conversations/${conversationId}/agent-run/active`),

  continue: (conversationId: string, body: { action: 'continue' | 'stop' | 'retry' | 'cancel'; stepKey?: string }) =>
    chatApi.post(`/api/conversations/${conversationId}/agent-run/continue`, body),

  cancel: (conversationId: string) =>
    chatApi.post(`/api/conversations/${conversationId}/agent-run/cancel`),

  listStepArtifacts: (conversationId: string) =>
    chatApi.get(`/api/conversations/${conversationId}/step-artifacts`),
};

// ── Admin Pricing Config (model schemas / task definitions / task-model bindings / discounts) ──
// Wraps services/api/.../admin/pricing-config/pricing-config-admin.controller.ts (@Controller('admin')).
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import type { LocalizedText } from '@autix/domain/model';

export type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
export type { LocalizedText } from '@autix/domain/model';

/** GET /api/admin/models/:id — full editable view of one model's schema/description state. */
export interface AdminModelDetail {
  id: string;
  description: LocalizedText;
  paramsSchema: ParamsSchema | null;
  pricingSchema: PricingSchema | null;
  schemaVersion: number;
}

export interface UpdateModelSchemasInput {
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
}

/** PUT /api/admin/models/:id/schemas response — both schemas are non-null once validated & saved. */
export interface AdminModelSchemas {
  id: string;
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
  schemaVersion: number;
}

export interface UpdateModelDescriptionInput {
  description: LocalizedText;
}

export interface AdminModelDescription {
  id: string;
  description: LocalizedText;
}

export interface DryRunPricingInput {
  paramsSchema: ParamsSchema;
  pricingSchema: PricingSchema;
  sampleParams: Record<string, unknown>;
  sampleUsage?: Record<string, unknown>;
}

/**
 * Mirrors DryRunResult in pricing-config-admin.service.ts. Reuses the `Breakdown` interface
 * already defined above for the public tasksApi quote result — both are `{ id, op, contribution,
 * accumulatorAfter }` and `op` is the domain's `TermOp` ('add' | 'mul') either way.
 */
export interface DryRunResult {
  total: number;
  breakdown: Breakdown[];
}

export const ADMIN_TASK_CATEGORIES = ['chat', 'image', 'video', 'prompt'] as const;
export type AdminTaskCategory = (typeof ADMIN_TASK_CATEGORIES)[number];

/** task_definitions row (pricing-config-admin.repository.ts findMany — no `select`, full row). */
export interface AdminTaskDefinition {
  id: string;
  taskType: string;
  name: string;
  category: AdminTaskCategory;
  fixedCostSchema: PricingSchema | null;
  isActive: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDefinitionInput {
  taskType: string;
  name: string;
  category: AdminTaskCategory;
  fixedCostSchema?: PricingSchema | null;
}

export interface UpdateTaskDefinitionInput {
  name?: string;
  category?: AdminTaskCategory;
  fixedCostSchema?: PricingSchema | null;
  isActive?: boolean;
  sort?: number;
}

/**
 * task_model_bindings row. `multiplier` is Prisma `Decimal(6, 3)` — decimal.js's `toJSON`
 * delegates to `toString()` (see node_modules/decimal.js: `P.valueOf = P.toJSON`), so it
 * serializes over HTTP as a JSON string (e.g. "1.000"), never a bare number. Callers must
 * `Number(...)` it before doing arithmetic.
 */
export interface TaskModelBinding {
  taskType: string;
  modelConfigId: string;
  /** 可读模型名（后台绑定页显示用；缺省时回退到 modelConfigId） */
  modelName: string;
  /** 网关 model-id，如 gpt-5.5 / doubao-seedance-2.0 */
  model: string;
  multiplier: string;
  isDefault: boolean;
  isActive: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskModelBindingInput {
  taskType: string;
  modelConfigId: string;
  multiplier?: number;
  isDefault?: boolean;
}

export interface UpdateTaskModelBindingInput {
  multiplier?: number;
  isDefault?: boolean;
  isActive?: boolean;
  sort?: number;
}

/** Mirrors AdminDiscountScope in pricing-config-admin.service.ts. Unknown extra keys pass through. */
export interface PricingDiscountScope {
  membershipLevelNumbers?: number[];
  taskTypes?: string[];
  modelConfigIds?: string[];
  [key: string]: unknown;
}

/**
 * pricing_discounts row. `factor` is Prisma `Decimal(6, 3)` — same string-wire-type reasoning as
 * `TaskModelBinding.multiplier` above.
 */
export interface PricingDiscount {
  id: string;
  code: string;
  name: string;
  factor: string;
  scope: PricingDiscountScope;
  stackable: boolean;
  priority: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountInput {
  code: string;
  name: string;
  factor: number;
  scope: PricingDiscountScope;
  stackable?: boolean;
  priority?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface UpdateDiscountInput {
  name?: string;
  factor?: number;
  scope?: PricingDiscountScope;
  stackable?: boolean;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export const adminPricingApi = {
  getModel: (id: string) => chatApi.get<AdminModelDetail>(`/api/admin/models/${id}`),
  updateModelSchemas: (id: string, data: UpdateModelSchemasInput) =>
    chatApi.put<AdminModelSchemas>(`/api/admin/models/${id}/schemas`, data),
  updateModelDescription: (id: string, data: UpdateModelDescriptionInput) =>
    chatApi.put<AdminModelDescription>(`/api/admin/models/${id}/description`, data),
  dryRunPricing: (data: DryRunPricingInput) =>
    chatApi.post<DryRunResult>('/api/admin/pricing/dry-run', data),

  listTaskDefinitions: () => chatApi.get<AdminTaskDefinition[]>('/api/admin/task-definitions'),
  createTaskDefinition: (data: CreateTaskDefinitionInput) =>
    chatApi.post<AdminTaskDefinition>('/api/admin/task-definitions', data),
  updateTaskDefinition: (taskType: string, data: UpdateTaskDefinitionInput) =>
    chatApi.put<AdminTaskDefinition>(`/api/admin/task-definitions/${taskType}`, data),
  deleteTaskDefinition: (taskType: string) =>
    chatApi.delete<AdminTaskDefinition>(`/api/admin/task-definitions/${taskType}`),

  listTaskModelBindings: (taskType?: string) =>
    chatApi.get<TaskModelBinding[]>('/api/admin/task-model-bindings', { params: { taskType } }),
  createTaskModelBinding: (data: CreateTaskModelBindingInput) =>
    chatApi.post<TaskModelBinding>('/api/admin/task-model-bindings', data),
  updateTaskModelBinding: (
    taskType: string,
    modelConfigId: string,
    data: UpdateTaskModelBindingInput,
  ) =>
    chatApi.put<TaskModelBinding>(
      `/api/admin/task-model-bindings/${taskType}/${modelConfigId}`,
      data,
    ),
  deleteTaskModelBinding: (taskType: string, modelConfigId: string) =>
    chatApi.delete<TaskModelBinding>(
      `/api/admin/task-model-bindings/${taskType}/${modelConfigId}`,
    ),

  listDiscounts: () => chatApi.get<PricingDiscount[]>('/api/admin/discounts'),
  createDiscount: (data: CreateDiscountInput) =>
    chatApi.post<PricingDiscount>('/api/admin/discounts', data),
  updateDiscount: (id: string, data: UpdateDiscountInput) =>
    chatApi.put<PricingDiscount>(`/api/admin/discounts/${id}`, data),
  deleteDiscount: (id: string) => chatApi.delete<PricingDiscount>(`/api/admin/discounts/${id}`),
};

// Default export for existing import compatibility.
export default userApi;
