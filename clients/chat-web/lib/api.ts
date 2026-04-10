import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const USER_API = process.env.NEXT_PUBLIC_USER_API_URL || 'http://localhost:4002/api';
const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  msg: string;
  traceId: string;
  data: T;
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

  // Unwrap { success, code, msg, traceId, data } → { data }
  instance.interceptors.response.use(
    (res) => {
      const payload = res.data as ApiResponse<any>;
      if (payload && 'success' in payload) {
        if (!payload.success) {
          // Reconstruct an error that mirrors the server shape
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
        // Replace axios response data with the actual payload data
        res.data = payload.data;
      }
      return res;
    },
    async (error: AxiosError) => {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const res = error.response;

      // Handle wrapped error responses
      if (res) {
        const payload = res.data as ApiResponse<any>;
        if (payload && 'success' in payload && !payload.success) {
          (error as any).code = payload.code;
          (error as any).msg = payload.msg;
        }
      }

      // 401 refresh
      if (res?.status === 401 && !original?._retry) {
        original._retry = true;
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refreshToken')
          : null;
        if (refreshToken) {
          try {
            // Refresh returns raw wrapped response — extract token from data.data
            const refreshRes = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
              `${USER_API}/auth/refresh`,
              { refreshToken },
            );
            const { accessToken, refreshToken: newRefresh } = refreshRes.data.data!;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefresh);
            original.headers.Authorization = `Bearer ${accessToken}`;
            return instance(original);
          } catch {
            localStorage.clear();
            window.location.href = '/login';
          }
        } else {
          localStorage.clear();
          window.location.href = '/login';
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
