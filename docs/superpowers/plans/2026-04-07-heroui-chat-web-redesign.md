# HeroUI 重构 chat-web 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 chat-web 的 UI 层从自定义 CSS 变量完全迁移到 HeroUI v3，移除 next-themes，使用 HeroUI 内置 dark mode 和组件库。

**Architecture:** 保留所有业务逻辑层（API、Store、React Query、Zustand），仅替换 UI 组件层。分 8 个 Chunk 依次改造，每个 Chunk 独立可测试。

**Tech Stack:** Next.js 15 + Tailwind CSS v4 + @heroui/react v3 + React Hook Form + Zod

---

## Chunk 1: 安装 HeroUI 依赖

**Files:**
- Modify: `clients/chat-web/package.json`

- [ ] **Step 1: 添加 HeroUI 依赖**

Run in `clients/chat-web/`:
```bash
npm install @heroui/react @heroui/system framer-motion
```

Expected: 安装成功，`@heroui/react` 版本应为 v3.x

- [ ] **Step 2: 验证安装**

Run: `cat package.json | grep heroui`
Expected: 看到 `@heroui/react` 和 `@heroui/system` 在 dependencies 中

---

## Chunk 2: Theme 配置 — globals.css 和 layout.tsx

**Files:**
- Modify: `clients/chat-web/app/globals.css`
- Modify: `clients/chat-web/app/layout.tsx`
- Modify: `clients/chat-web/components/providers.tsx`

**注意：** 整个改造计划中，globals.css 和 layout.tsx 是最关键的第一个验证点——必须先确认 HeroUI 能正常渲染后再继续。

- [ ] **Step 1: 重写 globals.css**

完全替换 `app/globals.css` 内容为：

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import "tailwindcss";
@import "@heroui/react/theme";

@theme inline {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "Fira Code", monospace;
}

@layer base {
  * {
    box-sizing: border-box;
  }
  html {
    scroll-behavior: smooth;
  }
  body {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

**说明：** 删除了所有自定义 CSS 变量（`--background`、`--primary` 等），完全使用 HeroUI 的设计 token。

- [ ] **Step 2: 重写 layout.tsx**

完全替换 `app/layout.tsx` 内容为：

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
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased h-full min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**关键改动：** `data-theme="dark"` 在 html 元素上，HeroUI 会自动读取这个属性来切换暗色模式。移除了 next-themes 的 ThemeProvider。

- [ ] **Step 3: 重写 providers.tsx 添加 HeroUI Provider**

完全替换 `components/providers.tsx` 内容为：

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KProvider } from '@heroui/react';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <KProvider>{children}</KProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: 验证 HeroUI 渲染**

Run: `cd clients/chat-web && npm run dev`
Expected: 启动成功，访问 http://localhost:3000 不报错

**验证方法：** 临时修改 `app/(chat)/page.tsx` 返回一个 HeroUI Button 组件：
```tsx
import { Button } from '@heroui/react';
export default function TestPage() {
  return <Button color="primary">Test HeroUI</Button>;
}
```
访问 `/login` 确认 HeroUI 按钮正常渲染，然后恢复原文件。

---

## Chunk 3: 登录页面重写

**Files:**
- Modify: `clients/chat-web/app/login/page.tsx`

- [ ] **Step 1: 完全重写 login/page.tsx**

将 `app/login/page.tsx` 替换为：

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
import { Button, Input } from '@heroui/react';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');
    try {
      const { data: tokens } = await userApi.post('/auth/login', data);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      const { data: profile } = await userApi.get('/auth/profile');
      setUser(profile);
      if (profile.status === 'PENDING') {
        router.push('/pending');
        return;
      }
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-background to-secondary">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20 border border-primary/30">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Autix AI</div>
              <div className="text-foreground/60 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              AI 驱动的
              <br />
              <span className="text-success">需求分析</span> 助理
            </h2>
            <p className="mt-3 text-foreground/60 text-sm leading-relaxed">
              通过自然语言对话，帮您快速完成需求结构化、方案评审与文档生成。
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/30 border border-primary/30">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground/80 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typing demo */}
        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">
            &gt; 分析用户登录功能需求...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
            <p className="text-foreground/60 text-sm mt-1">智能需求分析助理</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">开始对话</h1>
            <p className="text-foreground/50 text-sm">登录以使用 AI 智能助理</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              {...register('username', { required: '请输入用户名' })}
              label="账号"
              placeholder="输入您的账号"
              autoComplete="username"
              variant="bordered"
              color={errors.username ? 'danger' : 'default'}
              errorMessage={errors.username?.message}
            />

            <Input
              {...register('password', { required: '请输入密码' })}
              label="密码"
              placeholder="输入您的密码"
              type={isVisible ? 'text' : 'password'}
              autoComplete="current-password"
              variant="bordered"
              color={errors.password ? 'danger' : 'default'}
              errorMessage={errors.password?.message}
              endContent={
                <button type="button" onClick={() => setIsVisible(!isVisible)}>
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {error && (
              <div className="rounded-xl p-3 text-sm text-danger bg-danger/10 border border-danger/20" role="alert">
                {error}
              </div>
            )}

            <Button
              type="submit"
              color="success"
              className="w-full font-medium"
              isLoading={isLoading}
            >
              {isLoading ? '登录中...' : '开始对话 →'}
            </Button>
          </form>

          <p className="text-center text-sm text-foreground/50">
            没有账号？{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="cursor-pointer text-primary hover:underline"
            >
              立即注册
            </button>
          </p>

          <p className="text-center text-xs text-foreground/30">
            © 2024 Autix AI · 需求分析助理
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证登录页面**

Run: `cd clients/chat-web && npm run dev`
Expected: 访问 /login，HeroUI Input 和 Button 正常渲染，登录功能逻辑保持不变

---

## Chunk 4: 注册页面重写

**Files:**
- Modify: `clients/chat-web/app/register/page.tsx`

- [ ] **Step 1: 完全重写 register/page.tsx**

将 `app/register/page.tsx` 替换为 HeroUI 组件版本。主要改动：
- `input` → `Input` (HeroUI)
- `button` → `Button` (HeroUI)
- 保留 `useForm` 和 `react-hook-form` 逻辑
- 保留 `inputStyle` 对象删除，改用 HeroUI `Input` 的 `variant="bordered"`
- `style={{ background: ... }}` → Tailwind classes using HeroUI token (`bg-primary/xx`, `text-foreground`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { MessageSquare, Eye, EyeOff } from 'lucide-react';
import { registerUser } from '@/lib/api';
import { Button, Input } from '@heroui/react';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();
  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError('');
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        systemCode: 'chat',
      });
      router.push('/pending');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError(msg || '注册失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - 复用 login 页面的左侧设计 */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-background to-secondary">
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20 border border-primary/30">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Autix AI</div>
              <div className="text-foreground/60 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-white leading-tight">
            加入 Autix AI
            <br />
            <span className="text-success">开启智能分析</span>
          </h2>
          <p className="text-foreground/60 text-sm leading-relaxed">
            注册后，管理员将在 1 个工作日内完成审批。审批通过后即可开始使用。
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">
            &gt; 分析用户需求结构...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">创建账号</h1>
            <p className="text-foreground/50 text-sm">填写信息后等待管理员审批</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('username', {
                required: '请输入用户名',
                minLength: { value: 3, message: '用户名至少 3 个字符' },
                maxLength: { value: 20, message: '用户名最多 20 个字符' },
              })}
              label="用户名"
              placeholder="3-20 个字符"
              autoComplete="username"
              variant="bordered"
              color={errors.username ? 'danger' : 'default'}
              errorMessage={errors.username?.message}
            />

            <Input
              {...register('email', {
                required: '请输入邮箱',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入有效的邮箱地址' },
              })}
              type="email"
              label="邮箱"
              placeholder="your@email.com"
              autoComplete="email"
              variant="bordered"
              color={errors.email ? 'danger' : 'default'}
              errorMessage={errors.email?.message}
            />

            <Input
              {...register('password', {
                required: '请输入密码',
                minLength: { value: 6, message: '密码至少 6 个字符' },
              })}
              label="密码"
              placeholder="至少 6 个字符"
              type={isVisible ? 'text' : 'password'}
              autoComplete="new-password"
              variant="bordered"
              color={errors.password ? 'danger' : 'default'}
              errorMessage={errors.password?.message}
              endContent={
                <button type="button" onClick={() => setIsVisible(!isVisible)}>
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <Input
              {...register('confirmPassword', {
                required: '请确认密码',
                validate: (v) => v === password || '两次密码不一致',
              })}
              label="确认密码"
              placeholder="再次输入密码"
              type={isConfirmVisible ? 'text' : 'password'}
              autoComplete="new-password"
              variant="bordered"
              color={errors.confirmPassword ? 'danger' : 'default'}
              errorMessage={errors.confirmPassword?.message}
              endContent={
                <button type="button" onClick={() => setIsConfirmVisible(!isConfirmVisible)}>
                  {isConfirmVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {error && (
              <div className="rounded-xl p-3 text-sm text-danger bg-danger/10 border border-danger/20" role="alert">
                {error}
              </div>
            )}

            <Button
              type="submit"
              color="success"
              className="w-full font-medium"
              isLoading={isLoading}
            >
              {isLoading ? '注册中...' : '注册 →'}
            </Button>
          </form>

          <p className="text-center text-sm text-foreground/50">
            已有账号？{' '}
            <button
              onClick={() => router.push('/login')}
              className="cursor-pointer text-primary hover:underline"
            >
              立即登录
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证注册页面**

Run dev server, 访问 /register
Expected: HeroUI Input 和 Button 正常渲染，注册表单验证正常工作

---

## Chunk 5: Pending 页面重写

**Files:**
- Modify: `clients/chat-web/app/pending/page.tsx`

- [ ] **Step 1: 重写 pending/page.tsx**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Button, Card, CardBody } from '@heroui/react';

export default function PendingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md" shadow="lg">
        <CardBody className="text-center space-y-6 py-12">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-warning/20 border-2 border-warning/40">
              <Clock className="w-10 h-10 text-warning" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">账号审批中</h1>
            <p className="text-foreground/60 text-sm leading-relaxed">
              您的账号已提交，正在等待管理员审批。
            </p>
            <p className="text-foreground/40 text-sm">审批通过后请重新登录。</p>
          </div>

          <Button
            variant="bordered"
            color="primary"
            className="w-full"
            onPress={() => router.push('/login')}
          >
            返回登录
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
```

---

## Chunk 6: 聊天布局和侧边栏重写

**Files:**
- Modify: `clients/chat-web/app/(chat)/layout.tsx`
- Modify: `clients/chat-web/components/chat/sidebar.tsx`

- [ ] **Step 1: 重写 (chat)/layout.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { ChatSidebar } from '@/components/chat/sidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted && !isAuthenticated) router.push('/login');
    if (mounted && user?.status === 'PENDING') router.push('/pending');
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || user?.status === 'PENDING') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ChatSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: 重写 sidebar.tsx**

主要改动：
- `aside` → HeroUI `Navbar` + `Dropdown`
- 所有 `style={{ background: ... }}` → HeroUI token classes (`bg-background`, `bg-primary`, `text-foreground`)
- 所有 `style={{ border: ... }}` → Tailwind border utilities
- 搜索框 `input` → HeroUI `Input` with `startContent` icon
- 会话列表项：保留业务逻辑，改用 HeroUI 样式

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
import { useRouter } from 'next/navigation';
import { Navbar, NavbarContent, NavbarItem, Button, Input, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar, Badge } from '@heroui/react';

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
    <Navbar
      className="flex h-full w-[260px] flex-col bg-background border-r border-divider"
      classNames={{
        wrapper: 'px-0 h-full w-full flex-col',
      }}
    >
      {/* Header / Brand */}
      <NavbarContent className="px-4 py-4 border-b border-divider">
        <NavbarItem className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="font-semibold text-white text-sm">Autix AI</span>
        </NavbarItem>
      </NavbarContent>

      {/* New chat button */}
      <NavbarContent className="px-4 py-3">
        <NavbarItem className="w-full">
          <Button
            color="primary"
            className="w-full font-medium"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleNew}
          >
            新建对话
          </Button>
        </NavbarItem>
      </NavbarContent>

      {/* Search */}
      <NavbarContent className="px-3 py-2">
        <NavbarItem className="w-full">
          <Input
            value={search}
            onValueChange={setSearch}
            placeholder="搜索对话..."
            variant="bordered"
            size="sm"
            startContent={<Search className="w-3.5 h-3.5 text-foreground/40" />}
            classNames={{
              inputWrapper: 'bg-secondary/50 border-border',
              input: 'text-xs',
            }}
          />
        </NavbarItem>
      </NavbarContent>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
        {Object.entries(grouped).map(([group, items]) =>
          items.length > 0 ? (
            <div key={group}>
              <p className="px-2 py-1 text-xs font-medium text-foreground/40">
                {group === 'Today' ? '今天' : group === 'Yesterday' ? '昨天' : '更早'}
              </p>
              {items.map((session) => (
                <Dropdown key={session.id}>
                  <DropdownTrigger>
                    <button
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-left ${
                        activeSessionId === session.id
                          ? 'bg-primary/30 text-white'
                          : 'text-foreground/60 hover:bg-content2/50'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-foreground/40" />
                      <span className="flex-1 truncate text-xs">{session.title}</span>
                    </button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="会话操作">
                    <DropdownItem
                      key="delete"
                      className="text-danger"
                      color="danger"
                      startContent={<Trash2 className="w-4 h-4" />}
                      onPress={() => deleteSession(session.id)}
                    >
                      删除
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              ))}
            </div>
          ) : null
        )}
        {sessions.length === 0 && (
          <p className="text-center text-xs py-8 text-foreground/30">
            还没有对话，点击"新建对话"开始
          </p>
        )}
      </div>

      {/* User footer */}
      <NavbarContent className="px-3 py-3 border-t border-divider">
        <Dropdown placement="top">
          <DropdownTrigger>
            <button className="flex items-center gap-2 w-full cursor-pointer hover:bg-content2/30 rounded-lg px-2 py-1.5 transition-colors">
              <Avatar
                size="sm"
                icon={<User className="w-3.5 h-3.5" />}
                classNames={{
                  base: 'bg-primary/40',
                  icon: 'text-foreground/60',
                }}
              />
              <span className="text-xs text-foreground/70 truncate">
                {(user as any)?.realName || (user as any)?.username || '用户'}
              </span>
            </button>
          </DropdownTrigger>
          <DropdownMenu aria-label="用户菜单">
            <DropdownItem
              key="logout"
              color="danger"
              startContent={<LogOut className="w-4 h-4" />}
              onPress={handleLogout}
            >
              退出登录
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>
    </Navbar>
  );
}
```

**说明：** HeroUI 的 `Navbar` 默认是顶部导航，这里用它作为侧边栏容器，通过 `className="flex h-full w-[260px] flex-col"` 让它变成垂直侧边栏样式。

---

## Chunk 7: 新建消息气泡和聊天输入组件

**Files:**
- Create: `clients/chat-web/components/chat/MessageBubble.tsx`
- Create: `clients/chat-web/components/chat/ChatInput.tsx`

- [ ] **Step 1: 创建 MessageBubble.tsx**

```tsx
'use client';

import { Avatar } from '@heroui/react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar
        size="sm"
        icon={isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        classNames={{
          base: isUser ? 'bg-success/20' : 'bg-primary/40',
          icon: isUser ? 'text-success' : 'text-foreground/60',
        }}
      />
      <div
        className={`rounded-2xl px-5 py-4 max-w-2xl text-sm leading-relaxed ${
          isUser ? 'rounded-tr-none bg-success/15 border border-success/25 text-success-foreground/90' : 'rounded-tl-none bg-secondary border border-border text-foreground/85'
        }`}
      >
        {content === '' && isStreaming ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 ChatInput.tsx**

```tsx
'use client';

import { useState, useRef } from 'react';
import { Button, Textarea } from '@heroui/react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-3 rounded-2xl p-3 bg-secondary border border-border">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="描述您的需求... (Ctrl+Enter 发送)"
        minRows={1}
        maxRows={6}
        isDisabled={isStreaming}
        variant="flat"
        classNames={{
          base: 'flex-1',
          inputWrapper: 'bg-transparent shadow-none border-0',
          input: 'text-sm text-foreground placeholder:text-foreground/30 py-1',
        }}
        className="flex-1"
      />
      <Button
        isIconOnly
        color="success"
        className="flex-shrink-0"
        isDisabled={!input.trim() || isStreaming}
        onPress={handleSend}
      >
        {isStreaming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
```

---

## Chunk 8: 聊天主页重写

**Files:**
- Modify: `clients/chat-web/app/(chat)/page.tsx`

- [ ] **Step 1: 重写 (chat)/page.tsx**

使用 Chunk 7 创建的 `MessageBubble` 和 `ChatInput` 组件重构聊天页面。

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat.store';
import { MessageSquare } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { Badge } from '@heroui/react';

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = getActiveSession();

  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      const id = createSession();
      setActiveSession(id);
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) return;

    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

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

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground/40">
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
      <div className="flex items-center px-6 h-14 border-b border-divider bg-background/80 flex-shrink-0">
        <h2 className="text-sm font-medium text-white truncate">{activeSession.title}</h2>
        <Badge color="primary" variant="flat" className="ml-3 text-xs">
          需求分析模式
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {activeSession.messages.length === 0 && (
          <MessageBubble
            role="assistant"
            content={`您好！我是 Autix AI 需求分析助理。
请描述您的需求，我来帮您进行结构化分析与整理。

提示：Ctrl+Enter 发送消息`}
          />
        )}

        {activeSession.messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={isStreaming && i === activeSession.messages.length - 1 && msg.content === ''}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-divider bg-background/80">
        <ChatInput onSend={handleSend} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
```

---

## 验证清单

改造完成后，验证以下内容：

1. **登录页** (`/login`) — HeroUI Input/Button 渲染，登录流程正常
2. **注册页** (`/register`) — 表单验证正常，注册成功跳转 /pending
3. **Pending页** (`/pending`) — HeroUI Card 渲染
4. **聊天主页** (`/`) — 侧边栏、消息气泡、输入框全部 HeroUI 化
5. **Dark mode** — `data-theme="dark"` 生效，所有颜色使用 HeroUI token
6. **功能回归** — 登录/注册/聊天/新建会话/删除会话/退出登录全部正常工作
