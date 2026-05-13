import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { getAuth, getNavigation, getEnv } from './adapters';

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  msg: string;
  traceId: string;
  // 实际值是 T，但后端会按 { list, pagination } 包装；声明为 any 让消费方按需 cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

let refreshPromise: Promise<void> | null = null;

async function doRefresh(userApiUrl: string): Promise<void> {
  const auth = getAuth();
  const refreshToken = await auth.getRefreshToken();

  if (!refreshToken) {
    await auth.clearTokens();
    getNavigation().push('/login');
    return;
  }

  try {
    const refreshRes = await axios.post<
      ApiResponse<{ accessToken: string; refreshToken: string }>
    >(`${userApiUrl}/auth/refresh`, { refreshToken });
    const tokens = refreshRes.data.data as { accessToken: string; refreshToken: string };
    await auth.setTokens(tokens.accessToken, tokens.refreshToken);
  } catch {
    await auth.clearTokens();
    getNavigation().push('/login');
  }
}

function createApiInstance(getBaseUrl: () => string, getUserApiUrl: () => string): AxiosInstance {
  const instance = axios.create({ timeout: 10000 });

  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (!config.baseURL) {
      config.baseURL = getBaseUrl();
    }
    const auth = getAuth();
    const token = await auth.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const lang = (await auth.getLanguage()) || DEFAULT_LANGUAGE;
    config.headers['Accept-Language'] = lang;
    return config;
  });

  instance.interceptors.response.use(
    (res) => {
      const payload = res.data as ApiResponse<unknown>;
      if (payload && typeof payload === 'object' && 'success' in payload) {
        if (!payload.success) {
          const err = new AxiosError(payload.msg, 'API_ERROR', res.config, res.request, res);
          (err as AxiosError & { code?: string }).code = payload.code;
          return Promise.reject(err);
        }
        // 保留 payload.data 原始结构 — 不强制拆 list/pagination：
        //   - user-system 接口：data = { list, pagination }
        //   - chat 接口：data = { items, total, ... } 或裸对象/数组
        // 调用方按各自后端契约处理；同时把 pagination 暴露到 res 顶层方便复用
        const data = payload.data;
        if (data && typeof data === 'object' && 'pagination' in data) {
          (res as { pagination?: unknown }).pagination = (data as { pagination?: unknown })
            .pagination;
        }
        res.data = data;
      }
      return res;
    },
    async (error: AxiosError) => {
      const original = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;
      const res = error.response;

      if (res?.data && typeof res.data === 'object' && 'success' in res.data) {
        const payload = res.data as ApiResponse<unknown>;
        (error as AxiosError & { msg?: string; code?: string }).msg = payload.msg;
        (error as AxiosError & { msg?: string; code?: string }).code = payload.code;
      }

      if (res?.status === 401 && original && !original.url?.includes('/auth/login')) {
        if (!original._retry) {
          original._retry = true;

          if (!refreshPromise) {
            refreshPromise = doRefresh(getUserApiUrl()).finally(() => {
              refreshPromise = null;
            });
          }

          try {
            await refreshPromise;
            const newToken = await getAuth().getAccessToken();
            if (newToken && original.headers) {
              original.headers.Authorization = `Bearer ${newToken}`;
            }
            return instance(original);
          } catch {
            return Promise.reject(error);
          }
        }

        await getAuth().clearTokens();
        getNavigation().push('/login');
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

export const userApi = createApiInstance(
  () => getEnv().userApiUrl,
  () => getEnv().userApiUrl,
);
export const chatApi = createApiInstance(
  () => getEnv().chatApiUrl,
  () => getEnv().userApiUrl,
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

// ── Conversations ────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  title: string;
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

export const getConversations = () => chatApi.get<Conversation[]>('/api/conversations');
export const createConversation = (title?: string) =>
  chatApi.post<Conversation>('/api/conversations', { title });
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
}

export const generateConversationImage = (
  id: string,
  data: {
    model: string;
    n?: number;
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
export const getDocumentWithChunks = (id: string) =>
  chatApi.get<any>(`/api/documents/${id}`);
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
export interface TaskEvent {
  id: string;
  taskType: string;
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

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
  isDefault: boolean;
  capabilities: string[];
  visibility: string;
  metadata?: {
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    apiKey?: string;
  };
}

export const getAvailableModels = () => chatApi.get<ModelConfigItem[]>('/api/models/available');
export const getAllModels = () => chatApi.get<ModelConfigItem[]>('/api/models/admin');
export const deleteModel = (id: string) => chatApi.delete(`/api/models/${id}`);
export const createModel = (data: Record<string, unknown>) => chatApi.post('/api/models', data);
export const updateModel = (id: string, data: Record<string, unknown>) =>
  chatApi.put(`/api/models/${id}`, data);

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
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ImageTemplate extends ResourceCommon {
  prompt: string;
  variables: TemplateVariable[];
  exampleImages: string[];
  modelHint?: string;
}

export interface VideoTemplate extends ResourceCommon {
  prompt: string;
  variables: TemplateVariable[];
  exampleMedia: string[];
  modelHint?: string;
  durationSec?: number;
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
    like: (id: string) => chatApi.post<TResource>(`${base}/${id}/like`),
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
  };
}

export const imageTemplateAdminApi = makeAdminApi<ImageTemplate>('image-templates');
export const videoTemplateAdminApi = makeAdminApi<VideoTemplate>('video-templates');
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
export interface MembershipLevel {
  id: string;
  name: string;
  level: number;
  monthlyPrice: string;
  pointsPerMonth: number;
  features: string[] | null;
  plans: MembershipPlan[];
}

export interface MembershipPlan {
  id: string;
  levelId: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  months: number;
  autoRenew: boolean;
  originalPrice: string;
  price: string;
  firstTimePrice: string | null;
  discountLabel: string | null;
  firstTimeLabel: string | null;
  points: number;
}

export interface UserMembership {
  id: string;
  userId: string;
  levelId: string;
  level: MembershipLevel;
  planId: string | null;
  autoRenew: boolean;
  startedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

export interface MembershipInfo {
  membership: UserMembership | null;
  pointsBalance: number;
}

export const membershipApi = {
  getPublicLevels: () => chatApi.get<MembershipLevel[]>('/api/membership/public/levels'),
  getLevels: () =>
    chatApi.get<{ levels: MembershipLevel[]; isFirstTime: boolean }>('/api/membership/levels'),
  getMe: () => chatApi.get<MembershipInfo>('/api/membership/me'),
  purchase: (planId: string) => chatApi.post<Order>('/api/membership/purchase', { planId }),
};

// ── Points ──────────────────────────────────────────────────────────────
export interface PointsBalance {
  userId: string;
  balance: number;
}

export interface PointsRecord {
  id: string;
  userId: string;
  type: 'EARN' | 'CONSUME';
  amount: number;
  source: 'MEMBERSHIP' | 'PACKAGE' | 'TASK' | 'INVITATION' | 'ADMIN_GRANT' | 'AGENT_CALL';
  sourceId: string | null;
  balance: number;
  remark: string | null;
  createdAt: string;
}

export interface PointsPackage {
  id: string;
  name: string;
  price: string;
  points: number;
}

export interface TaskPointCost {
  id: string;
  taskType: string;
  name: string;
  cost: number;
}

export const pointsApi = {
  getBalance: () => chatApi.get<PointsBalance>('/api/points/balance'),
  getRecords: (params?: { page?: number; pageSize?: number; source?: string }) =>
    chatApi.get<PaginatedResult<PointsRecord>>('/api/points/records', { params }),
  getPackages: () => chatApi.get<PointsPackage[]>('/api/points/packages'),
  purchasePackage: (packageId: string) =>
    chatApi.post<Order>(`/api/points/packages/${packageId}/purchase`),
  getTaskCosts: () => chatApi.get<TaskPointCost[]>('/api/points/task-costs'),
};

// ── Orders ──────────────────────────────────────────────────────────────
export interface Order {
  id: string;
  userId: string;
  orderNo: string;
  orderType: 'MEMBERSHIP' | 'POINTS_PACKAGE';
  productId: string;
  productName: string;
  originalPrice: string;
  amount: string;
  isFirstTime: boolean;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  paidAt: string | null;
  createdAt: string;
}

export const orderApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    orderType?: string;
  }) => chatApi.get<PaginatedResult<Order>>('/api/orders', { params }),
  getById: (id: string) => chatApi.get<Order>(`/api/orders/${id}`),
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
  getCode: () => chatApi.get<InviteCode>('/api/invite/code'),
  getRecords: () => chatApi.get<InviteRecord[]>('/api/invite/records'),
};

// ── Membership Admin ────────────────────────────────────────────────────
export const membershipAdminApi = {
  getLevels: () => chatApi.get<MembershipLevel[]>('/api/admin/membership/levels'),
  createLevel: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/membership/levels', data),
  updateLevel: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/membership/levels/${id}`, data),

  getPlans: () => chatApi.get<MembershipPlan[]>('/api/admin/membership/plans'),
  createPlan: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/membership/plans', data),
  updatePlan: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/membership/plans/${id}`, data),

  getPackages: () => chatApi.get<PointsPackage[]>('/api/admin/points/packages'),
  createPackage: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/points/packages', data),
  updatePackage: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/points/packages/${id}`, data),

  getTaskCosts: () => chatApi.get<TaskPointCost[]>('/api/admin/points/task-costs'),
  createTaskCost: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/points/task-costs', data),
  updateTaskCost: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/points/task-costs/${id}`, data),

  getOrders: (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: string;
    orderType?: string;
  }) => chatApi.get<PaginatedResult<Order>>('/api/admin/orders', { params }),

  getPointsRecords: (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    source?: string;
  }) => chatApi.get<PaginatedResult<PointsRecord>>('/api/admin/points/records', { params }),

  getUsers: (params?: { page?: number; pageSize?: number; search?: string }) =>
    chatApi.get<PaginatedResult<unknown>>('/api/admin/users', { params }),

  getUserDetail: (userId: string) => chatApi.get<unknown>(`/api/admin/users/${userId}`),

  grantMembership: (userId: string, data: { levelId: string; months?: number }) =>
    chatApi.post(`/api/admin/users/${userId}/grant-membership`, data),

  grantPoints: (
    userId: string,
    data: { points?: number; remark?: string; packageId?: string },
  ) => chatApi.post(`/api/admin/users/${userId}/grant-points`, data),

  approveUser: (userId: string, data?: { note?: string }) =>
    chatApi.post(`/api/admin/users/${userId}/approve`, data ?? {}),
};

// ── Image Generation ────────────────────────────────────────────────────
export const imageGenApi = {
  generate: (
    body: Record<string, unknown>,
    amuxConfig: { baseUrl: string; apiKey: string },
  ) =>
    chatApi.post('/api/image-gen/generate', body, {
      headers: { 'X-Amux-Base-Url': amuxConfig.baseUrl, 'X-Amux-Api-Key': amuxConfig.apiKey },
      timeout: 120000,
    }),

  chat: (body: Record<string, unknown>, amuxConfig: { baseUrl: string; apiKey: string }) =>
    chatApi.post('/api/image-gen/chat', body, {
      headers: { 'X-Amux-Base-Url': amuxConfig.baseUrl, 'X-Amux-Api-Key': amuxConfig.apiKey },
      timeout: 120000,
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

// Default export for legacy import compatibility (admin-web pattern)
export default userApi;
