# Autix Chat & Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign admin-web login page, create a standalone chat-web app, and protect the chat service with JWT auth.

**Architecture:** Three independent work tracks that can be done in sequence. chat service JWT guard is simplest and done first. admin-web login is a pure UI replacement. chat-web is a new Next.js app bootstrapped from admin-web's structure.

**Tech Stack:** Next.js (App Router), shadcn/ui, Zustand, TanStack Query, Tailwind CSS v4, NestJS, PassportJS, @nestjs/jwt

---

## Track 1: services/chat JWT Guard

### Task 1: Install JWT dependencies in chat service

**Files:**
- Modify: `services/chat/package.json`

**Step 1: Add dependencies**

```bash
cd services/chat
bun add @nestjs/passport @nestjs/jwt passport passport-jwt
bun add -d @types/passport-jwt
```

**Step 2: Verify install**

```bash
cat services/chat/package.json | grep -E "passport|jwt"
```
Expected: shows `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt` in dependencies.

**Step 3: Commit**

```bash
git add services/chat/package.json services/chat/bun.lockb 2>/dev/null || git add services/chat/package.json
git commit -m "chore(chat): add nestjs jwt/passport dependencies"
```

---

### Task 2: Add JWT_SECRET to chat service .env

**Files:**
- Modify: `services/chat/.env`

**Step 1: Add JWT_SECRET**

Open `services/chat/.env` and append:
```
JWT_SECRET="your-super-secret-key-min-32-chars-change-in-production"
```
Must be the exact same value as `services/user-system/.env` `JWT_SECRET`.

**Step 2: Verify both envs match**

```bash
grep JWT_SECRET services/user-system/.env services/chat/.env
```
Expected: both lines show identical values.

**Step 3: Commit**

```bash
git add services/chat/.env
git commit -m "chore(chat): add JWT_SECRET env var"
```

---

### Task 3: Create JWT strategy and guard

**Files:**
- Create: `services/chat/src/auth/jwt.strategy.ts`
- Create: `services/chat/src/auth/jwt-auth.guard.ts`
- Create: `services/chat/src/auth/auth.module.ts`

**Step 1: Create `services/chat/src/auth/jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      username: payload.username,
      sessionId: payload.sessionId,
    };
  }
}
```

**Step 2: Create `services/chat/src/auth/jwt-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Step 3: Create `services/chat/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
```

**Step 4: Commit**

```bash
git add services/chat/src/auth/
git commit -m "feat(chat): add JWT strategy and auth guard"
```

---

### Task 4: Wire AuthModule into AppModule and protect LlmController

**Files:**
- Modify: `services/chat/src/app.module.ts`
- Modify: `services/chat/src/llm/llm.controller.ts`

**Step 1: Update `services/chat/src/app.module.ts`**

Replace the entire file:
```typescript
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { LlmModule } from "./llm/llm.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [LlmModule, AuthModule],
})
export class AppModule {}
```

**Step 2: Update `services/chat/src/llm/llm.controller.ts`**

Add to imports at top:
```typescript
import { UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
```

Add `@UseGuards(JwtAuthGuard)` decorator above the class:
```typescript
@UseGuards(JwtAuthGuard)
@Controller("chat/langchain")
export class LlmController {
```

**Step 3: Build to verify no TypeScript errors**

```bash
cd services/chat && bun run build
```
Expected: build succeeds with no errors.

**Step 4: Commit**

```bash
git add services/chat/src/app.module.ts services/chat/src/llm/llm.controller.ts
git commit -m "feat(chat): protect LLM endpoints with JWT guard"
```

---

## Track 2: admin-web Login Page Redesign

### Task 5: Redesign admin-web login page

**Files:**
- Modify: `clients/admin-web/app/login/page.tsx`

**Step 1: Replace `clients/admin-web/app/login/page.tsx` entirely**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Users,
  Layers,
  Activity,
} from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

const features = [
  { icon: Shield, text: '统一身份认证' },
  { icon: Users, text: '细粒度权限控制' },
  { icon: Layers, text: '多系统接入' },
  { icon: Activity, text: '实时审计日志' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const { data: tokens } = await api.post('/auth/login', data);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      const { data: profile } = await api.get('/auth/profile');
      setUser(profile, profile.menus || []);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden
        bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700">
        {/* Grid texture overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Floating shapes */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-white font-bold text-lg font-mono">A</span>
            </div>
            <div>
              <div className="text-white font-bold text-xl font-mono">Autix</div>
              <div className="text-white/60 text-xs">Admin Console</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              企业级用户权限
              <br />
              管理平台
            </h2>
            <p className="mt-3 text-white/70 text-sm leading-relaxed">
              统一管理组织内所有系统的用户、角色与权限，提升安全性与运营效率。
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Version */}
        <div className="relative z-10">
          <span className="text-white/40 text-xs font-mono">v2.0.0</span>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <span className="text-2xl font-bold font-mono text-primary">Autix</span>
            <p className="text-muted-foreground text-sm mt-1">用户权限管理系统</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">欢迎回来</h1>
            <p className="text-muted-foreground text-sm">请输入您的账户凭据以继续</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                用户名
              </Label>
              <Input
                id="username"
                {...register('username', { required: '请输入用户名' })}
                placeholder="admin"
                autoComplete="username"
                className="h-11"
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                密码
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: '请输入密码' })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 rotate-45" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 cursor-pointer font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            © 2024 Autix · 用户权限管理系统
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page renders**

```bash
cd clients/admin-web && bun run dev
```
Open `http://localhost:3001/login` (or whatever port). Confirm:
- Split screen on desktop (≥1024px)
- Left: gradient background, feature list, Autix logo
- Right: form with show/hide password toggle
- Mobile: single column with logo at top

**Step 3: Commit**

```bash
git add clients/admin-web/app/login/page.tsx
git commit -m "feat(admin-web): redesign login page with split-screen layout"
```

---

## Track 3: clients/chat-web New Application

### Task 6: Bootstrap chat-web project

**Files:**
- Create: `clients/chat-web/package.json`
- Create: `clients/chat-web/next.config.ts`
- Create: `clients/chat-web/tsconfig.json`
- Create: `clients/chat-web/.env.local`

**Step 1: Create `clients/chat-web/package.json`**

```json
{
  "name": "@repo/chat-web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.400.0",
    "next": "15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.51.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.5.0",
    "tailwind-merge": "^2.3.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/react-syntax-highlighter": "^15.5.13",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create `clients/chat-web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

**Step 3: Create `clients/chat-web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create `clients/chat-web/.env.local`**

```
NEXT_PUBLIC_USER_API_URL=http://localhost:4002/api
NEXT_PUBLIC_CHAT_API_URL=http://localhost:4001
```

**Step 5: Install dependencies**

```bash
cd clients/chat-web && bun install
```

**Step 6: Commit**

```bash
git add clients/chat-web/package.json clients/chat-web/next.config.ts clients/chat-web/tsconfig.json clients/chat-web/.env.local
git commit -m "chore(chat-web): bootstrap project config"
```

---

### Task 7: Create chat-web global styles and utilities

**Files:**
- Create: `clients/chat-web/app/globals.css`
- Create: `clients/chat-web/lib/utils.ts`

**Step 1: Create `clients/chat-web/app/globals.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import "tailwindcss";

@theme inline {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "Fira Code", monospace;
}

:root {
  --background: #0F0F23;
  --foreground: #F8FAFC;
  --card: #1a1a2e;
  --card-foreground: #F8FAFC;
  --primary: #4338CA;
  --primary-foreground: #ffffff;
  --secondary: #1E1B4B;
  --secondary-foreground: #F8FAFC;
  --muted: #1E1B4B;
  --muted-foreground: #94A3B8;
  --accent: #22C55E;
  --accent-foreground: #fff;
  --destructive: #EF4444;
  --border: rgba(255,255,255,0.1);
  --input: #1E1B4B;
  --ring: #4338CA;
  --radius: 0.75rem;
}

@layer base {
  * {
    box-sizing: border-box;
    border-color: var(--border);
  }
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
}
```

**Step 2: Create `clients/chat-web/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Commit**

```bash
git add clients/chat-web/app/globals.css clients/chat-web/lib/utils.ts
git commit -m "feat(chat-web): add global styles and utilities"
```

---

### Task 8: Create auth store and API clients for chat-web

**Files:**
- Create: `clients/chat-web/lib/auth.ts`
- Create: `clients/chat-web/lib/api.ts`
- Create: `clients/chat-web/store/auth.store.ts`

**Step 1: Create `clients/chat-web/lib/auth.ts`**

```typescript
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('chat_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('chat_user', JSON.stringify(user));
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('chat_user');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
```

**Step 2: Create `clients/chat-web/lib/api.ts`**

Two axios instances: one for user-system auth, one for chat service.

```typescript
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
```

**Step 3: Create `clients/chat-web/store/auth.store.ts`**

```typescript
import { create } from 'zustand';
import { getStoredUser, storeUser, clearAuth } from '@/lib/auth';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  setUser: (user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  setUser: (user) => {
    storeUser(user);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isAuthenticated: false });
  },
}));
```

**Step 4: Commit**

```bash
git add clients/chat-web/lib/ clients/chat-web/store/
git commit -m "feat(chat-web): add auth store and API clients"
```

---

### Task 9: Create root layout and providers for chat-web

**Files:**
- Create: `clients/chat-web/components/providers.tsx`
- Create: `clients/chat-web/app/layout.tsx`

**Step 1: Create `clients/chat-web/components/providers.tsx`**

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Step 2: Create `clients/chat-web/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autix AI - 智能需求分析助理',
  description: 'Autix AI 智能对话系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add clients/chat-web/components/providers.tsx clients/chat-web/app/layout.tsx
git commit -m "feat(chat-web): add root layout and providers"
```

---

### Task 10: Create chat-web login page

**Files:**
- Create: `clients/chat-web/app/login/page.tsx`

**Step 1: Create `clients/chat-web/app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/auth.store';
import { userApi } from '@/lib/api';
import {
  MessageSquare,
  Zap,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

const features = [
  { icon: MessageSquare, text: '流式 AI 对话' },
  { icon: BarChart3, text: '需求结构化分析' },
  { icon: BookOpen, text: '多会话历史管理' },
  { icon: Zap, text: '实时响应，低延迟' },
];

export default function ChatLoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const { data: tokens } = await userApi.post('/auth/login', data);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      const { data: profile } = await userApi.get('/auth/profile');
      setUser(profile);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F0F23 0%, #1E1B4B 50%, #312E81 100%)' }}
      >
        {/* Animated particle dots */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-indigo-400/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>
        {/* Gradient orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.3) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(67,56,202,0.4)', border: '1px solid rgba(99,102,241,0.5)' }}>
              <MessageSquare className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="text-white font-bold text-xl" style={{ fontFamily: 'Inter, sans-serif' }}>
                Autix AI
              </div>
              <div className="text-indigo-300 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              AI 驱动的
              <br />
              <span style={{ color: '#22C55E' }}>需求分析</span> 助理
            </h2>
            <p className="mt-3 text-indigo-200/70 text-sm leading-relaxed">
              通过自然语言对话，帮您快速完成需求结构化、方案评审与文档生成。
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(67,56,202,0.3)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                <span className="text-indigo-100/80 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typing demo */}
        <div className="relative z-10">
          <div className="text-indigo-300/40 text-xs font-mono">
            &gt; 分析用户登录功能需求...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: '#1a1a2e' }}
      >
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
            <p className="text-indigo-300/60 text-sm mt-1">智能需求分析助理</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">开始对话</h1>
            <p className="text-indigo-200/50 text-sm">登录以使用 AI 智能助理</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-indigo-100/80 block">
                账号
              </label>
              <input
                id="username"
                {...register('username', { required: '请输入用户名' })}
                placeholder="输入您的账号"
                autoComplete="username"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                style={{
                  background: 'rgba(30,27,75,0.8)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
              />
              {errors.username && (
                <p className="text-xs text-red-400">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-indigo-100/80 block">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: '请输入密码' })}
                  placeholder="输入您的密码"
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                  style={{
                    background: 'rgba(30,27,75,0.8)',
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'rgba(165,180,252,0.5)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div
                className="rounded-xl p-3 text-sm text-red-300 border"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-medium text-sm text-white cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? '#16a34a' : '#22C55E', color: '#000' }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                '开始对话 →'
              )}
            </button>
          </form>

          <p className="text-center text-xs" style={{ color: 'rgba(165,180,252,0.3)' }}>
            © 2024 Autix AI · 需求分析助理
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add clients/chat-web/app/login/
git commit -m "feat(chat-web): add AI-themed split-screen login page"
```

---

### Task 11: Create chat session store (localStorage persistence)

**Files:**
- Create: `clients/chat-web/store/chat.store.ts`

**Step 1: Create `clients/chat-web/store/chat.store.ts`**

```typescript
import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'autix_chat_sessions';
const MAX_SESSIONS = 50;

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateTitle(firstMessage: string): string {
  return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '');
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;

  createSession: () => string;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<Message, 'id'>) => void;
  appendToLastAssistantMessage: (sessionId: string, chunk: string) => void;
  setStreaming: (value: boolean) => void;
  getActiveSession: () => ChatSession | null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: loadSessions(),
  activeSessionId: null,
  isStreaming: false,

  createSession: () => {
    const id = generateId();
    const now = new Date().toISOString();
    const newSession: ChatSession = {
      id,
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => {
      const sessions = [newSession, ...state.sessions];
      saveSessions(sessions);
      return { sessions, activeSessionId: id };
    });
    return id;
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      saveSessions(sessions);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? null)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
  },

  addMessage: (sessionId, message) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const newMsg: Message = { ...message, id: generateId() };
        const messages = [...s.messages, newMsg];
        const title =
          s.messages.length === 0 && message.role === 'user'
            ? generateTitle(message.content)
            : s.title;
        return { ...s, messages, title, updatedAt: new Date().toISOString() };
      });
      saveSessions(sessions);
      return { sessions };
    });
  },

  appendToLastAssistantMessage: (sessionId, chunk) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (last && last.role === 'assistant') {
          messages[messages.length - 1] = { ...last, content: last.content + chunk };
        }
        return { ...s, messages, updatedAt: new Date().toISOString() };
      });
      saveSessions(sessions);
      return { sessions };
    });
  },

  setStreaming: (value) => set({ isStreaming: value }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },
}));
```

**Step 2: Commit**

```bash
git add clients/chat-web/store/chat.store.ts
git commit -m "feat(chat-web): add chat session store with localStorage persistence"
```

---

### Task 12: Create chat-web main page layout and sidebar

**Files:**
- Create: `clients/chat-web/app/(chat)/layout.tsx`
- Create: `clients/chat-web/components/chat/sidebar.tsx`

**Step 1: Create `clients/chat-web/app/(chat)/layout.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { ChatSidebar } from '@/components/chat/sidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.push('/login');
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0F0F23' }}>
      <ChatSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
```

**Step 2: Create `clients/chat-web/components/chat/sidebar.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

function groupByDate(sessions: ReturnType<typeof useChatStore.getState>['sessions']) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, typeof sessions> = { Today: [], Yesterday: [], Earlier: [] };
  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups['Today'].push(s);
    else if (d >= yesterday) groups['Yesterday'].push(s);
    else groups['Earlier'].push(s);
  }
  return groups;
}

export function ChatSidebar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const [search, setSearch] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(filtered);

  const handleNew = () => {
    const id = createSession();
    setActiveSession(id);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className="w-[260px] flex flex-col flex-shrink-0 border-r"
      style={{ background: '#1a1a2e', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Autix AI</span>
        </div>
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors"
          style={{ background: '#4338CA' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4F46E5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#4338CA')}
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-300/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-indigo-100 placeholder:text-indigo-300/30 outline-none"
            style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
        {Object.entries(grouped).map(([group, items]) =>
          items.length > 0 ? (
            <div key={group}>
              <p className="px-2 py-1 text-xs font-medium" style={{ color: 'rgba(165,180,252,0.4)' }}>
                {group === 'Today' ? '今天' : group === 'Yesterday' ? '昨天' : '更早'}
              </p>
              {items.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setActiveSession(session.id)}
                  onMouseEnter={() => setHovered(session.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    'group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm',
                    activeSessionId === session.id
                      ? 'text-white'
                      : 'text-indigo-200/60 hover:text-indigo-100'
                  )}
                  style={{
                    background: activeSessionId === session.id
                      ? 'rgba(67,56,202,0.3)'
                      : hovered === session.id
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/60" />
                  <span className="flex-1 truncate text-xs">{session.title}</span>
                  {hovered === session.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="flex-shrink-0 cursor-pointer text-red-400/60 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null
        )}
        {sessions.length === 0 && (
          <p className="text-center text-xs py-8" style={{ color: 'rgba(165,180,252,0.3)' }}>
            还没有对话，点击"新建对话"开始
          </p>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(67,56,202,0.4)' }}>
              <User className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <span className="text-xs text-indigo-200/70 truncate">
              {(user as any)?.realName || (user as any)?.username || '用户'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="cursor-pointer text-indigo-300/40 hover:text-red-400 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
```

**Step 3: Commit**

```bash
git add clients/chat-web/app/ clients/chat-web/components/
git commit -m "feat(chat-web): add chat layout and sidebar with session management"
```

---

### Task 13: Create main chat page with streaming

**Files:**
- Create: `clients/chat-web/app/(chat)/page.tsx`

**Step 1: Create `clients/chat-web/app/(chat)/page.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chat.store';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

export default function ChatPage() {
  const {
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    addMessage,
    appendToLastAssistantMessage,
    setStreaming,
    isStreaming,
    getActiveSession,
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = getActiveSession();

  // Auto-create session on mount if none
  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      const id = createSession();
      setActiveSession(id);
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !activeSessionId) return;

    const content = input.trim();
    setInput('');

    // Add user message
    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    // Add empty assistant message (will be filled by stream)
    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const response = await fetch(`${CHAT_API_URL}/chat/langchain/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input: content }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          appendToLastAssistantMessage(activeSessionId, chunk);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, '\n\n*[请求出错，请重试]*');
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(165,180,252,0.4)' }}>
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">选择或创建一个对话开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center px-6 h-14 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(26,26,46,0.8)' }}
      >
        <h2 className="text-sm font-medium text-white truncate">{activeSession.title}</h2>
        <span className="ml-3 text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(67,56,202,0.3)', color: 'rgba(165,180,252,0.8)' }}>
          需求分析模式
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {activeSession.messages.length === 0 && (
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(67,56,202,0.4)' }}>
              <Bot className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="rounded-2xl rounded-tl-none px-5 py-4 max-w-2xl"
              style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-sm text-indigo-100/80">
                您好！我是 Autix AI 需求分析助理。
                <br />请描述您的需求，我来帮您进行结构化分析与整理。
                <br /><span className="text-xs text-indigo-300/50 mt-2 block">
                  提示：Ctrl+Enter 发送消息
                </span>
              </p>
            </div>
          </div>
        )}

        {activeSession.messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: msg.role === 'user'
                  ? 'rgba(34,197,94,0.2)'
                  : 'rgba(67,56,202,0.4)',
              }}
            >
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-green-400" />
                : <Bot className="w-4 h-4 text-indigo-300" />
              }
            </div>
            <div
              className={`rounded-2xl px-5 py-4 max-w-2xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'
              }`}
              style={{
                background: msg.role === 'user'
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(30,27,75,0.6)',
                border: msg.role === 'user'
                  ? '1px solid rgba(34,197,94,0.25)'
                  : '1px solid rgba(99,102,241,0.2)',
                color: msg.role === 'user' ? 'rgba(187,247,208,0.9)' : 'rgba(224,231,255,0.85)',
              }}
            >
              {msg.content === '' && isStreaming && i === activeSession.messages.length - 1 ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {isStreaming && i === activeSession.messages.length - 1 && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5" />
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-6 pb-6 pt-4 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(15,15,35,0.8)' }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl p-3"
          style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.25)' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述您的需求... (Ctrl+Enter 发送)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-indigo-100 placeholder:text-indigo-300/30 outline-none min-h-[24px] max-h-[144px] py-1 disabled:opacity-50"
            style={{ lineHeight: '1.6' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 144) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#22C55E' }}
            onMouseEnter={(e) => !isStreaming && (e.currentTarget.style.background = '#16a34a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#22C55E')}
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 text-black animate-spin" />
              : <Send className="w-4 h-4 text-black" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add clients/chat-web/app/\(chat\)/page.tsx
git commit -m "feat(chat-web): add main chat page with streaming support"
```

---

### Task 14: Final wiring - root redirect page

**Files:**
- Create: `clients/chat-web/app/page.tsx` (redirect to chat)

**Step 1: Create `clients/chat-web/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/');
}
```

Wait — since `(chat)/page.tsx` is the root of the `(chat)` route group, and the layout wraps it, the root `/` already serves the chat page. No separate redirect needed.

Instead, make sure login page is accessible at `/login` and the main chat is at `/` within the `(chat)` group.

The structure should be:
```
app/
  layout.tsx              ← root layout
  login/
    page.tsx              ← /login
  (chat)/
    layout.tsx            ← auth guard + sidebar
    page.tsx              ← / (main chat)
```

This is already set up by Tasks 9-13. Verify by running the dev server.

**Step 2: Run dev and verify**

```bash
cd clients/chat-web && bun run dev
```

Test:
- Navigate to `http://localhost:3002` → should redirect to `/login`
- Login with valid credentials → should show chat interface
- Create a new conversation, send a message (chat service must be running with JWT guard)
- Refresh page → conversation history should persist from localStorage
- Check sidebar shows grouped sessions

**Step 3: Final commit**

```bash
git add clients/chat-web/
git commit -m "feat(chat-web): complete AI chat frontend with auth and streaming"
```

---

## Verification Checklist

### services/chat
- [ ] `bun run build` passes with no errors
- [ ] Without token: `curl -X POST http://localhost:4001/chat/langchain/invoke -d '{"input":"test"}' -H "Content-Type: application/json"` returns 401
- [ ] With valid token: same request returns result

### admin-web login
- [ ] Split screen on lg+ screens (≥1024px)
- [ ] Stacked layout on mobile (<1024px)
- [ ] Show/hide password toggle works
- [ ] Login error displays correctly
- [ ] Successful login navigates to `/`
- [ ] Dark mode renders correctly

### chat-web
- [ ] `/login` shows AI-themed split-screen
- [ ] Login flow authenticates against user-system
- [ ] `localhost:3002` redirects to `/login` if not authenticated
- [ ] New conversation created on first load
- [ ] Messages stream in real-time from chat service
- [ ] Conversation history persists after page refresh
- [ ] Delete conversation works
- [ ] Search conversations works
- [ ] Logout clears auth and redirects to `/login`

---

## Phase C Upgrade Path (Future)

When ready to add DB persistence to chat service:

1. Add Prisma to `services/chat`
2. Create schema: `Conversation(id, userId, title, createdAt)` + `Message(id, conversationId, role, content, timestamp)`
3. Add REST endpoints: `GET /conversations`, `POST /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`
4. In `chat-web`, replace localStorage calls in `chat.store.ts` with API calls
5. Data structure is compatible — no frontend changes needed beyond the API layer
