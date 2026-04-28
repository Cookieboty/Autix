import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearAuth } from '@/lib/auth';

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
export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  systemCode: string;
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
  createdAt: string;
  updatedAt: string;
  turns?: ArenaTurn[];
}

export interface ArenaTurn {
  id: string;
  sessionId: string;
  userMessage: string;
  createdAt: string;
  responses: ArenaResponseRecord[];
}

export interface ArenaResponseRecord {
  id: string;
  turnId: string;
  modelConfigId: string;
  content: string;
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
