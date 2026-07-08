// 领域 API 集合。请求基础设施（鉴权/刷新/SSE/上传/axios 实例工厂）已抽到 ./client-core。
import type {
  TaskEvent,
  CanvasAction,
  CanvasActionEstimate,
  CanvasBoard,
  CanvasBoardState,
  CanvasEntitlement,
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
  body: { systemCode: string; clientType: string; redirectUri: string },
) => userApi.post<{ authorizeUrl: string }>(`/auth/link/${provider}`, body);

export const unlinkOAuth = (provider: string) =>
  userApi.delete(`/auth/unlink/${provider}`);

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
  chatApi.post('/api/models/system', data);
export const updateSystemModel = (id: string, data: Record<string, unknown>) =>
  chatApi.put(`/api/models/system/${id}`, data);
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

export const materialsApi = {
  entitlement: () => chatApi.get<MaterialEntitlement>('/api/materials/entitlement'),
  list: (params?: { type?: MaterialAssetType | 'all'; search?: string; page?: number; pageSize?: number; folderId?: string }) =>
    chatApi.get<MaterialListResult>('/api/materials', { params }),
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
  create: (data: { name: string }) => chatApi.post<MaterialFolderRow>('/api/material-folders', data),
  update: (id: string, data: { name?: string; sortOrder?: number }) =>
    chatApi.patch<MaterialFolderRow>(`/api/material-folders/${id}`, data),
  remove: (id: string) => chatApi.delete(`/api/material-folders/${id}`),
};

// ── Arena ────────────────────────────────────────────────────────────────
export interface ArenaSession {
  id: string;
  userId: string;
  title: string;
  selectedModelIds?: string[];
  createdAt: string;
  updatedAt: string;
  turns?: ArenaTurn[];
}

export interface ArenaTurn {
  id: string;
  sessionId: string;
  userMessage: string;
  images?: string[];
  createdAt: string;
  responses: ArenaResponseRecord[];
}

export interface ArenaResponseRecord {
  id: string;
  turnId: string;
  modelConfigId: string;
  content: string;
  images?: string[];
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export const arenaApi = {
  getSessions: () => chatApi.get<ArenaSession[]>('/api/arena'),
  createSession: (title?: string) => chatApi.post<ArenaSession>('/api/arena', { title }),
  getSession: (id: string) => chatApi.get<ArenaSession>(`/api/arena/${id}`),
  deleteSession: (id: string) => chatApi.delete(`/api/arena/${id}`),
  clearTurns: (id: string) => chatApi.delete(`/api/arena/${id}/turns`),
  updateSelectedModels: (id: string, modelIds: string[]) =>
    chatApi.patch(`/api/arena/${id}/models`, { modelIds }),
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
   * Final params actually sent to the upstream after server-side coercion
   * and/or a safe-default retry. `coerced=true` means the UI should re-sync
   * the form to these values (and may show a "已自动调整参数" hint).
   */
  appliedSettings?: {
    size?: string;
    quality?: string;
    count: number;
    coerced: boolean;
    notes: string[];
    kind: 'gpt-image' | 'gemini-flash-image' | 'gemini-3-pro-image' | 'gemini-3-flash-image' | 'compatible';
  };
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
  getWorkbenchDefault: () =>
    chatApi.get('/api/video-projects/workbench/default'),
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
    importTemplates: (items: Record<string, any>[]) =>
      chatApi.post<{ jobId: string }>(`${base}/import`, { items }),
    importTemplate: () =>
      chatApi.get<Record<string, any>[]>(`${base}/import-template`),
    exportTemplates: (params?: { status?: string; category?: string }) =>
      chatApi.get<TResource[]>(`${base}/export`, { params }),
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

export interface PublicGrowthHomeSection {
  key: string;
  type: string;
  title: string;
  subtitle?: string | null;
  layout?: string | null;
  items: PublicGrowthMediaItem[];
}

export interface PublicGrowthHome {
  promo: {
    label: string;
    href: string;
  };
  mediaRail: PublicGrowthMediaItem[];
  featureMatrix: PublicGrowthFeature[];
  banner: PublicGrowthFeature;
  masonryItems: PublicGrowthMediaItem[];
  tagRail: Array<{ label: string; href: string }>;
  sections: PublicGrowthHomeSection[];
  collections: PublicGrowthCollection[];
}

export interface PublicCollectionDetail {
  collection: PublicGrowthCollection;
  items: PublicGrowthMediaItem[];
}

export interface PublicCreatorProfile {
  userId: string;
  handle: string;
  displayName: string;
  avatar?: string | null;
  bio?: string | null;
  followerCount: number;
  followingCount: number;
  externalLinks?: Record<string, unknown> | null;
}

export interface PublicCreatorDetail {
  profile: PublicCreatorProfile;
}

export interface PublicGrowthEventInput {
  eventName: string;
  path: string;
  anonymousId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export const publicGrowthApi = {
  home: (params?: { locale?: string }) =>
    chatApi.get<PublicGrowthHome>('/api/public/home', { params }),
  page: (slug: string, params?: { locale?: string }) =>
    chatApi.get<PublicGrowthPage>(`/api/public/pages/${encodeURIComponent(slug)}`, { params }),
  collections: (params?: { kind?: PublicCollectionKind; locale?: string }) =>
    chatApi.get<PublicGrowthCollection[]>('/api/public/collections', { params }),
  collection: (slug: string, params?: { locale?: string }) =>
    chatApi.get<PublicCollectionDetail>(
      `/api/public/collections/${encodeURIComponent(slug)}`,
      { params },
    ),
  creator: (handle: string) =>
    chatApi.get<PublicCreatorDetail>(`/api/public/creators/${encodeURIComponent(handle)}`),
  followCreator: (handle: string) =>
    chatApi.post<{ followed: boolean; followerCount: number }>(
      `/api/public/creators/${encodeURIComponent(handle)}/follow`,
      {},
    ),
  event: (data: PublicGrowthEventInput) =>
    chatApi.post('/api/public/events', data),
};

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
};

// ── Membership ──────────────────────────────────────────────────────────
export type {
  MembershipLevel,
  MembershipPlan,
  MembershipInfo,
  PointsBalance,
  PointsRecord,
  PointsPackage,
  GenerationPricingRule,
  PricingRuleComponent,
  PricingRuleComponentType,
  PricingRulePreviewResult,
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
};

// ── Points ──────────────────────────────────────────────────────────────
import type {
  PointsBalance,
  PointsRecord,
  PointsPackage,
  GenerationPricingRule,
} from '@autix/domain/billing';

export interface GenerationPricingEstimateInput {
  taskType: string;
  modelProvider?: string;
  modelName?: string;
  quality?: string;
  resolution?: string;
  modelTier?: string;
  quantity?: number;
  seconds?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  toolCalls?: number;
  mcpCalls?: number;
  skillCalls?: number;
  batchCount?: number;
  referenceImages?: number;
  hasVideoInput?: boolean;
  hasAudioInput?: boolean;
  priority?: boolean;
  contextMode?: string;
  membershipLevel?: number;
  grantType?: 'SUBSCRIPTION' | 'PURCHASED' | 'GIFT' | 'COMPENSATION';
}

export interface GenerationPricingEstimate {
  estimatedCost: number;
  ruleId: string;
  taskType: string;
  ruleName: string;
  baseUnit: string;
  multiplier: number;
  items: Array<{ label: string; amount: number }>;
  pricingSnapshot: Record<string, unknown>;
  refundPolicy: Record<string, unknown> | null;
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
  getPricingRules: () => chatApi.get<GenerationPricingRule[]>('/api/points/pricing-rules'),
  estimate: (data: GenerationPricingEstimateInput) =>
    chatApi.post<GenerationPricingEstimate>('/api/points/estimate', data),
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

  getPricingRules: () => chatApi.get<GenerationPricingRule[]>('/api/admin/points/pricing-rules'),
  createPricingRule: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/points/pricing-rules', data),
  updatePricingRule: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/points/pricing-rules/${id}`, data),
  previewPricingRule: (data: Record<string, unknown>) =>
    chatApi.post<PricingRulePreviewResult>(
      '/api/admin/points/pricing-rules/preview',
      data,
    ),
  exportPricingRules: (body: {
    taskType: string;
    models: Array<{ provider: string; modelName: string }>;
    qualities?: string[];
    resolutions?: string[];
    modelTiers?: string[];
  }) =>
    chatApi.post<Blob>('/api/admin/points/pricing-rules/export', body, {
      responseType: 'blob',
    }),
  importPricingRules: (file: File, taskType: string, dryRun = false) => {
    const form = new FormData();
    form.append('file', file);
    return chatApi.post<{
      created: number;
      updated: number;
      errors: Array<{ row: number; name?: string; reason: string }>;
      dryRun: boolean;
    }>('/api/admin/points/pricing-rules/import', form, {
      params: { taskType, dryRun },
    });
  },

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

// ── Gallery Admin (广场审核) ─────────────────────────────────────────────
export interface GalleryPostAdminItem {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  title: string | null;
  coverImage: string | null;
  mediaUrls: string[];
  category: string;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN' | 'REMOVED';
  authorSnapshot: { displayName: string; avatarUrl?: string; at: string } | null;
  createdAt: string;
  publishedAt: string | null;
  sourceType: 'USER_UPLOAD' | 'FROM_GENERATION' | 'FROM_TEMPLATE' | 'ADMIN_CURATED';
}

export interface GalleryPendingPage {
  items: GalleryPostAdminItem[];
  nextCursor: string | null;
}

export type GalleryAdminStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REJECTED';

export const galleryAdminApi = {
  listPending: (cursor?: string) =>
    chatApi.get<GalleryPendingPage>('/api/admin/gallery/pending', {
      params: cursor ? { cursor } : undefined,
    }),
  listByStatus: (status: GalleryAdminStatus, cursor?: string) =>
    chatApi.get<GalleryPendingPage>('/api/admin/gallery', {
      params: cursor ? { status, cursor } : { status },
    }),
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
  importGallery: (items: Record<string, any>[]) =>
    chatApi.post<{ jobId: string }>('/api/admin/gallery/import', { items }),
  getGalleryImportTemplate: () =>
    chatApi.get<Record<string, any>[]>('/api/admin/gallery/import-template'),
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

// P2-C-1: PricingRulePreviewResult is now defined in @autix/domain/billing
import type { PricingRulePreviewResult } from '@autix/domain/billing';

// ── Image Generation ────────────────────────────────────────────────────
export const imageGenApi = {
  generate: (
    body: Record<string, unknown>,
    amuxConfig: { baseUrl: string; apiKey: string },
  ) =>
    chatApi.post('/api/image-gen/generate', body, {
      headers: { 'X-Amux-Base-Url': amuxConfig.baseUrl, 'X-Amux-Api-Key': amuxConfig.apiKey },
      timeout: LLM_REQUEST_TIMEOUT_MS,
    }),

  chat: (body: Record<string, unknown>, amuxConfig: { baseUrl: string; apiKey: string }) =>
    chatApi.post('/api/image-gen/chat', body, {
      headers: { 'X-Amux-Base-Url': amuxConfig.baseUrl, 'X-Amux-Api-Key': amuxConfig.apiKey },
      timeout: LLM_REQUEST_TIMEOUT_MS,
    }),

  models: (amuxConfig: { baseUrl: string; apiKey: string }) =>
    chatApi.get('/api/image-gen/models', {
      headers: { 'X-Amux-Base-Url': amuxConfig.baseUrl, 'X-Amux-Api-Key': amuxConfig.apiKey },
    }),
};

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

// Default export for existing import compatibility.
export default userApi;
