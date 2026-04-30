import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearAuth } from '@/lib/auth';
import { DEFAULT_LANGUAGE } from '@autix/i18n';

const USER_API = process.env.NEXT_PUBLIC_USER_API_URL || 'http://localhost:4002/api';
const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  msg: string;
  traceId: string;
  data: T | { list: T; pagination?: any } | any;
}

// Refresh lock — ensures only one /auth/refresh call is in-flight at a time
// across concurrent 401 responses.
let refreshPromise: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const refreshToken = typeof window !== 'undefined'
    ? localStorage.getItem('refreshToken')
    : null;

  if (!refreshToken) {
    clearAuth();
    window.location.href = '/login';
    return;
  }

  try {
    // Use bare axios (not the wrapped instance) to avoid interceptor recursion.
    // The user-system ResponseInterceptor wraps the body as:
    //   { success, code, msg, traceId, data: { accessToken, refreshToken, refreshIn } }
    const refreshRes = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${USER_API}/auth/refresh`,
      { refreshToken },
    );
    const tokens = refreshRes.data.data!;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  } catch {
    clearAuth();
    window.location.href = '/login';
  }
}

function createApiInstance(baseURL: string) {
  const instance = axios.create({ baseURL, timeout: 10000 });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const lang = localStorage.getItem('language') || DEFAULT_LANGUAGE;
      config.headers['Accept-Language'] = lang;
    }
    return config;
  });

  // Unwrap { success, code, msg, traceId, data: { list, pagination } }
  instance.interceptors.response.use(
    (res) => {
      const payload = res.data as ApiResponse<any>;
      if (payload && 'success' in payload) {
        if (!payload.success) {
          const err = new AxiosError(
            payload.msg,
            'API_ERROR',
            res.config,
            res,
          );
          (err as any).code = payload.code;
          (err as any).response = res;
          return Promise.reject(err);
        }
        // Extract pagination info if present
        if (payload.data?.pagination) {
          (res as any).pagination = payload.data.pagination;
        }
        // Set data to the list array
        res.data = payload.data?.list ?? payload.data;
      }
      return res;
    },
    async (error: AxiosError) => {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const res = error.response;

      if (res) {
        const payload = res.data as ApiResponse<any>;
        if (payload && 'success' in payload && !payload.success) {
          (error as any).code = payload.code;
          (error as any).msg = payload.msg;
        }
      }

      // 401: attempt token refresh (with single-flight lock)
      if (res?.status === 401 && !original?._retry) {
        original._retry = true;

        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
        }

        try {
          await refreshPromise;
          // Update the Authorization header with the new token and retry
          const newToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
          }
          return instance(original);
        } catch {
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    },
  );

  return instance;
}

export const userApi = createApiInstance(USER_API);
export const chatApi = createApiInstance(CHAT_API);

// Typed wrappers
export const updateMyLanguage = (language: string) =>
  userApi.patch('/users/me/language', { language });

export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  systemCode: string;
  inviteCode?: string;
}) => userApi.post('/auth/register', data);

// ── Conversations ──────────────────────────────────────────────────────────────
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
  messageType?: string;      // 消息类型
  uiResponse?: any;          // UI 响应（包含 thinking）
  thinking?: string;         // LLM 思考过程
  metadata?: {
    uiResponse?: any;
    uiStage?: string;
    interactionState?: any;
    [key: string]: any;
  };
}

export const getConversations = () =>
  chatApi.get<Conversation[]>('/api/conversations');

export const createConversation = (title?: string) =>
  chatApi.post<Conversation>('/api/conversations', { title });

export const deleteConversation = (id: string) =>
  chatApi.delete(`/api/conversations/${id}`);

export const getConversationMessages = (id: string, limit?: number) =>
  chatApi.get<ConversationMessage[]>(`/api/conversations/${id}/messages`, {
    params: limit ? { limit } : undefined,
  });

// ── Documents ──────────────────────────────────────────────────────────────────
export const getDocuments = () => chatApi.get<any[]>('/api/documents');
export const getDocumentWithChunks = (id: string) => chatApi.get<any>(`/api/documents/${id}`);
export const uploadDocument = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  form.append('filename', file.name);
  return chatApi.post('/api/documents/upload', form);
};
export const processDocument = (id: string) =>
  chatApi.post(`/api/documents/${id}/process`);
export const deleteDocument = (id: string) =>
  chatApi.delete(`/api/documents/${id}`);

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

// ── Model Config ─────────────────────────────────────────────────────────────────
export interface ModelConfigItem {
  id: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  /** 模型的感知能力标签，推荐值：text | vision | voice | speech | code | reasoning | image | embedding */
  capabilities: string[];
  visibility: string;
  metadata?: {
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    apiKey?: string;
  };
}

export const getAvailableModels = () =>
  chatApi.get<ModelConfigItem[]>('/api/models/available');

export const deleteModel = (id: string) =>
  chatApi.delete(`/api/models/${id}`);

export const createModel = (data: Record<string, unknown>) =>
  chatApi.post('/api/models', data);

export const updateModel = (id: string, data: Record<string, unknown>) =>
  chatApi.put(`/api/models/${id}`, data);

// ── Arena ─────────────────────────────────────────────────────────────────────
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
  createSession: (title?: string) =>
    chatApi.post<ArenaSession>('/api/arena', { title }),
  getSession: (id: string) =>
    chatApi.get<ArenaSession>(`/api/arena/${id}`),
  deleteSession: (id: string) => chatApi.delete(`/api/arena/${id}`),
  clearTurns: (id: string) => chatApi.delete(`/api/arena/${id}/turns`),
  updateSelectedModels: (id: string, modelIds: string[]) =>
    chatApi.patch(`/api/arena/${id}/models`, { modelIds }),
};

// ── Artifacts ─────────────────────────────────────────────────────────────────
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

  getVersions: (id: string) =>
    chatApi.get<ArtifactVersion[]>(`/api/artifacts/${id}/versions`),

  revertToVersion: (id: string, version: number) =>
    chatApi.post<Artifact>(`/api/artifacts/${id}/revert/${version}`),

  deleteArtifact: (id: string) => chatApi.delete(`/api/artifacts/${id}`),
};

// ── Template Marketplace ──────────────────────────────────────────────────────

export type TemplateStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface TemplateVariable {
  key: string;
  label: string;
  type: string;
  default?: string;
  options?: string[];
}

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  category: string;
  prompt: string;
  variables: TemplateVariable[];
  coverImage?: string;
  exampleImages: string[];
  modelHint?: string;
  tags: string[];
  version: number;
  status: TemplateStatus;
  rejectReason?: string;
  authorId: string;
  useCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface TemplateGeneration {
  id: string;
  templateId: string;
  template?: Pick<PromptTemplate, 'title' | 'coverImage' | 'category' | 'prompt' | 'variables'>;
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

export const templateApi = {
  list: (params?: {
    category?: string;
    search?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
    authorId?: string;
    status?: TemplateStatus;
  }) => chatApi.get<PaginatedResult<PromptTemplate>>('/api/templates', { params }),

  getById: (id: string) =>
    chatApi.get<PromptTemplate>(`/api/templates/${id}`),

  create: (data: Partial<PromptTemplate>) =>
    chatApi.post<PromptTemplate>('/api/templates', data),

  update: (id: string, data: Partial<PromptTemplate>) =>
    chatApi.put<PromptTemplate>(`/api/templates/${id}`, data),

  remove: (id: string) => chatApi.delete(`/api/templates/${id}`),

  like: (id: string) =>
    chatApi.post<PromptTemplate>(`/api/templates/${id}/like`),

  createGeneration: (templateId: string, data: {
    modelUsed: string;
    variables: Record<string, string>;
    referenceImage?: string;
  }) => chatApi.post<TemplateGeneration>(`/api/templates/${templateId}/generations`, data),
};

export const generationApi = {
  getById: (id: string) =>
    chatApi.get<TemplateGeneration>(`/api/generations/${id}`),

  addTurn: (id: string, data: { role: 'USER' | 'ASSISTANT'; content: string; images?: string[] }) =>
    chatApi.post<GenerationTurn>(`/api/generations/${id}/turns`, data),

  myGenerations: (params?: { page?: number; pageSize?: number }) =>
    chatApi.get<PaginatedResult<TemplateGeneration>>('/api/generations/my', { params }),
};

export const templateAdminApi = {
  list: (params?: { status?: TemplateStatus; page?: number; pageSize?: number }) =>
    chatApi.get<PaginatedResult<PromptTemplate>>('/api/admin/templates', { params }),

  review: (id: string, data: { action: 'approve' | 'reject' | 'revise'; reason?: string }) =>
    chatApi.post<PromptTemplate>(`/api/admin/templates/${id}/review`, data),
};

export const storageApi = {
  presign: (data: { fileName: string; contentType: string; folder?: string }) =>
    chatApi.post<{ uploadUrl: string; publicUrl: string; key: string }>('/api/storage/presign', data),
};

// ── Membership ───────────────────────────────────────────────────────────────

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
  getPublicLevels: () =>
    chatApi.get<MembershipLevel[]>('/api/membership/public/levels'),

  getLevels: () =>
    chatApi.get<{ levels: MembershipLevel[]; isFirstTime: boolean }>('/api/membership/levels'),

  getMe: () =>
    chatApi.get<MembershipInfo>('/api/membership/me'),

  purchase: (planId: string) =>
    chatApi.post<Order>('/api/membership/purchase', { planId }),
};

// ── Points ───────────────────────────────────────────────────────────────────

export interface PointsBalance {
  userId: string;
  balance: number;
}

export interface PointsRecord {
  id: string;
  userId: string;
  type: 'EARN' | 'CONSUME';
  amount: number;
  source: 'MEMBERSHIP' | 'PACKAGE' | 'TASK' | 'INVITATION' | 'ADMIN_GRANT';
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
  getBalance: () =>
    chatApi.get<PointsBalance>('/api/points/balance'),

  getRecords: (params?: { page?: number; pageSize?: number; source?: string }) =>
    chatApi.get<PaginatedResult<PointsRecord>>('/api/points/records', { params }),

  getPackages: () =>
    chatApi.get<PointsPackage[]>('/api/points/packages'),

  purchasePackage: (packageId: string) =>
    chatApi.post<Order>(`/api/points/packages/${packageId}/purchase`),

  getTaskCosts: () =>
    chatApi.get<TaskPointCost[]>('/api/points/task-costs'),
};

// ── Orders ───────────────────────────────────────────────────────────────────

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
  list: (params?: { page?: number; pageSize?: number; status?: string; orderType?: string }) =>
    chatApi.get<PaginatedResult<Order>>('/api/orders', { params }),

  getById: (id: string) =>
    chatApi.get<Order>(`/api/orders/${id}`),

  pay: (id: string) =>
    chatApi.post<Order>(`/api/orders/${id}/pay`),

  cancel: (id: string) =>
    chatApi.post<Order>(`/api/orders/${id}/cancel`),
};

// ── Invite ───────────────────────────────────────────────────────────────────

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
  getCode: () =>
    chatApi.get<InviteCode>('/api/invite/code'),

  getRecords: () =>
    chatApi.get<InviteRecord[]>('/api/invite/records'),
};

// ── Membership Admin ─────────────────────────────────────────────────────────

export const membershipAdminApi = {
  getLevels: () =>
    chatApi.get<MembershipLevel[]>('/api/admin/membership/levels'),
  createLevel: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/membership/levels', data),
  updateLevel: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/membership/levels/${id}`, data),

  getPlans: () =>
    chatApi.get<MembershipPlan[]>('/api/admin/membership/plans'),
  createPlan: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/membership/plans', data),
  updatePlan: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/membership/plans/${id}`, data),

  getPackages: () =>
    chatApi.get<PointsPackage[]>('/api/admin/points/packages'),
  createPackage: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/points/packages', data),
  updatePackage: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/points/packages/${id}`, data),

  getTaskCosts: () =>
    chatApi.get<TaskPointCost[]>('/api/admin/points/task-costs'),
  createTaskCost: (data: Record<string, unknown>) =>
    chatApi.post('/api/admin/points/task-costs', data),
  updateTaskCost: (id: string, data: Record<string, unknown>) =>
    chatApi.put(`/api/admin/points/task-costs/${id}`, data),

  getOrders: (params?: { page?: number; pageSize?: number; userId?: string; status?: string; orderType?: string }) =>
    chatApi.get<PaginatedResult<Order>>('/api/admin/orders', { params }),

  getPointsRecords: (params?: { page?: number; pageSize?: number; userId?: string; source?: string }) =>
    chatApi.get<PaginatedResult<PointsRecord>>('/api/admin/points/records', { params }),

  getUsers: (params?: { page?: number; pageSize?: number; search?: string }) =>
    chatApi.get<PaginatedResult<any>>('/api/admin/users', { params }),

  getUserDetail: (userId: string) =>
    chatApi.get<any>(`/api/admin/users/${userId}`),

  grantMembership: (userId: string, data: { levelId: string; months?: number }) =>
    chatApi.post(`/api/admin/users/${userId}/grant-membership`, data),

  grantPoints: (userId: string, data: { points?: number; remark?: string; packageId?: string }) =>
    chatApi.post(`/api/admin/users/${userId}/grant-points`, data),

  approveUser: (userId: string, data?: { note?: string }) =>
    chatApi.post(`/api/admin/users/${userId}/approve`, data ?? {}),
};

export const imageGenApi = {
  generate: (body: Record<string, unknown>, amuxConfig: { baseUrl: string; apiKey: string }) =>
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
