import axios from 'axios';

const USER_API = process.env.NEXT_PUBLIC_USER_API_URL || 'http://localhost:4002/api';
const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

// User-system API (login, profile, refresh)
export const userApi = axios.create({ baseURL: USER_API, timeout: 10000 });

userApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Chat service API (LLM endpoints)
export const chatApi = axios.create({ baseURL: CHAT_API, timeout: 60000 });

chatApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shared 401 refresh handler
function attach401Handler(instance: typeof userApi, refreshBaseUrl: string) {
  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && !original._retry) {
        original._retry = true;
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refreshToken')
          : null;
        if (refreshToken) {
          try {
            const { data } = await axios.post(`${refreshBaseUrl}/auth/refresh`, { refreshToken });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return instance.request(original);
          } catch {
            localStorage.clear();
            window.location.href = '/login';
          }
        } else {
          if (typeof window !== 'undefined') {
            localStorage.clear();
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
}

attach401Handler(userApi, USER_API);
attach401Handler(chatApi, USER_API);

export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  systemCode: string;
}) => userApi.post('/auth/register', data);
