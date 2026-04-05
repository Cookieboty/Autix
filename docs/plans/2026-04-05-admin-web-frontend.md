# RBAC Admin Web 前端实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建完整的 RBAC 权限管理系统前端，包含登录、用户管理、角色管理、权限管理和个人信息页面。

**Architecture:** 使用 Next.js 14 App Router，shadcn/ui 组件库，Tailwind CSS 样式，基于设计系统（紫色主题 + Data-Dense Dashboard 风格）。侧边栏根据用户权限动态渲染，表单使用 Drawer 风格，表格支持分页和搜索。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, @repo/types, Axios

---

## 阶段一：项目初始化

### Task 1: 创建 Next.js 项目并配置 shadcn/ui

**Files:**
- Create: `clients/admin-web/package.json`
- Create: `clients/admin-web/next.config.ts`
- Create: `clients/admin-web/tsconfig.json`
- Create: `clients/admin-web/tailwind.config.ts`
- Create: `clients/admin-web/components.json`
- Create: `clients/admin-web/app/layout.tsx`
- Create: `clients/admin-web/app/globals.css`
- Modify: `tsconfig.base.json`（添加 admin-web 路径映射）

**Step 1: 创建项目目录**

```bash
mkdir -p clients/admin-web
cd clients/admin-web
```

**Step 2: 初始化 Next.js 项目**

```bash
bun create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

选择：
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- App Router: Yes
- Import alias: @/*

**Step 3: 安装 shadcn/ui**

```bash
bunx shadcn@latest init
```

选择：
- Style: New York
- Base color: Slate
- CSS variables: Yes

**Step 4: 安装依赖**

```bash
bun add axios zustand @tanstack/react-query lucide-react
bun add -d @types/node
```

**Step 5: 更新 package.json**

添加 workspace 依赖：
```json
{
  "dependencies": {
    "@repo/types": "workspace:*"
  }
}
```

**Step 6: 配置 Tailwind（自定义主题色）**

修改 `tailwind.config.ts`：
```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#7C3AED",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#A78BFA",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#F97316",
          foreground: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Fira Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
```

**Step 7: 更新 globals.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: 271 81% 56%;
    --primary-foreground: 0 0% 100%;
    --secondary: 258 90% 76%;
    --secondary-foreground: 0 0% 100%;
    --accent: 24 95% 53%;
    --accent-foreground: 0 0% 100%;
  }
}
```

**Step 8: 安装 shadcn/ui 组件**

```bash
bunx shadcn@latest add button input label card table dialog sheet form select checkbox
```

**Step 9: 验证构建**

```bash
bun run build
```

Expected: 构建成功

**Step 10: Commit**

```bash
git add clients/admin-web
git commit -m "feat: initialize admin-web Next.js project with shadcn/ui"
```

---

### Task 2: 创建共享工具和类型

**Files:**
- Create: `clients/admin-web/lib/api.ts`（Axios 实例）
- Create: `clients/admin-web/lib/auth.ts`（认证工具）
- Create: `clients/admin-web/lib/utils.ts`（工具函数）
- Create: `clients/admin-web/types/index.ts`（扩展类型）
- Create: `clients/admin-web/store/auth.ts`（Zustand store）

**Step 1: 创建 API 客户端**

`lib/api.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api',
  timeout: 10000,
});

// 请求拦截器：添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token 过期，尝试刷新
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            { refreshToken }
          );
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          // 重试原请求
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api.request(error.config);
        } catch {
          // 刷新失败，跳转登录
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Step 2: 创建认证工具**

`lib/auth.ts`:
```typescript
import { AuthUser } from '@repo/types';

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function setUser(user: AuthUser) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export function hasPermission(permission: string): boolean {
  const user = getUser();
  return user?.permissions.includes(permission) ?? false;
}

export function hasAnyPermission(permissions: string[]): boolean {
  return permissions.some(hasPermission);
}
```

**Step 3: 创建 Zustand store**

`store/auth.ts`:
```typescript
import { create } from 'zustand';
import { AuthUser } from '@repo/types';
import { getUser, setUser as saveUser, clearAuth } from '@/lib/auth';

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: getUser(),
  isAuthenticated: !!getUser(),
  setUser: (user) => {
    saveUser(user);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    clearAuth();
    set({ user: null, isAuthenticated: false });
  },
  hasPermission: (permission) => {
    const { user } = get();
    return user?.permissions.includes(permission) ?? false;
  },
}));
```

**Step 4: Commit**

```bash
git add clients/admin-web/lib clients/admin-web/store clients/admin-web/types
git commit -m "feat: add API client, auth utils, and Zustand store"
```

---

## 阶段二：布局和导航

### Task 3: 创建 Dashboard 布局（侧边栏 + 顶栏）

**Files:**
- Create: `clients/admin-web/app/(dashboard)/layout.tsx`
- Create: `clients/admin-web/components/sidebar.tsx`
- Create: `clients/admin-web/components/header.tsx`
- Create: `clients/admin-web/components/user-menu.tsx`

**Step 1: 创建侧边栏组件**

`components/sidebar.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Shield, Key, User, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard', label: '概览', icon: LayoutDashboard, permission: null },
  { href: '/dashboard/users', label: '用户管理', icon: Users, permission: 'user:read' },
  { href: '/dashboard/roles', label: '角色管理', icon: Shield, permission: 'role:read' },
  { href: '/dashboard/permissions', label: '权限管理', icon: Key, permission: 'permission:read' },
  { href: '/dashboard/profile', label: '个人信息', icon: User, permission: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuthStore();

  const visibleItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold font-mono text-primary">RBAC Admin</h1>
      </div>
      <nav className="space-y-1 p-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 2: 创建顶栏组件**

`components/header.tsx`:
```typescript
'use client';

import { UserMenu } from './user-menu';

export function Header() {
  return (
    <header className="fixed left-60 right-0 top-0 z-10 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex-1" />
        <UserMenu />
      </div>
    </header>
  );
}
```

**Step 3: 创建用户菜单**

`components/user-menu.tsx`:
```typescript
'use client';

import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import api from '@/lib/api';

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      logout();
      router.push('/login');
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.realName || user.username}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
          <User className="mr-2 h-4 w-4" />
          个人信息
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 4: 创建 Dashboard 布局**

`app/(dashboard)/layout.tsx`:
```typescript
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-60">
        <Header />
        <main className="pt-16">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add clients/admin-web/app/\(dashboard\) clients/admin-web/components
git commit -m "feat: add dashboard layout with sidebar and header"
```

---

## 阶段三：页面实现

### Task 4: 登录页

**Files:**
- Create: `clients/admin-web/app/login/page.tsx`
- Create: `clients/admin-web/app/login/layout.tsx`

**Step 1: 创建登录页面**

`app/login/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const { data: tokens } = await api.post('/auth/login', data);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      
      const { data: profile } = await api.get('/auth/profile');
      setUser(profile);
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold font-mono text-center">RBAC Admin</CardTitle>
          <CardDescription className="text-center">
            输入您的凭据以访问系统
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                {...register('username', { required: '请输入用户名' })}
                placeholder="admin"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                {...register('password', { required: '请输入密码' })}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: 创建登录布局（无侧边栏）**

`app/login/layout.tsx`:
```typescript
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

**Step 3: Commit**

```bash
git add clients/admin-web/app/login
git commit -m "feat: add login page"
```

---

### Task 5: 用户管理页面

**Files:**
- Create: `clients/admin-web/app/(dashboard)/users/page.tsx`
- Create: `clients/admin-web/components/users/user-table.tsx`
- Create: `clients/admin-web/components/users/user-drawer.tsx`
- Create: `clients/admin-web/components/users/user-filters.tsx`

**Step 1: 创建用户管理主页面**

`app/(dashboard)/users/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserTable } from '@/components/users/user-table';
import { UserDrawer } from '@/components/users/user-drawer';
import { UserFilters } from '@/components/users/user-filters';

export default function UsersPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [filters, setFilters] = useState({ keyword: '', departmentId: '' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground">用户管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理系统用户账号和角色分配</p>
        </div>
        <Button
          onClick={() => { setEditingUser(null); setDrawerOpen(true); }}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          新增用户
        </Button>
      </div>

      <UserFilters filters={filters} onFiltersChange={setFilters} />

      <UserTable
        filters={filters}
        onEdit={(id) => { setEditingUser(id); setDrawerOpen(true); }}
      />

      <UserDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userId={editingUser}
      />
    </div>
  );
}
```

**Step 2: 创建用户表格组件**

`components/users/user-table.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, KeyRound, MoreHorizontal } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pagination } from '@/components/ui/pagination';
import api from '@/lib/api';

interface UserTableProps {
  filters: { keyword: string; departmentId: string };
  onEdit: (id: string) => void;
}

export function UserTable({ filters, onEdit }: UserTableProps) {
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['users', filters, page],
    queryFn: async () => {
      const { data } = await api.get('/users', {
        params: { page, pageSize, ...filters },
      });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteId(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-password`),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>真实姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-12">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items?.map((user: any) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono font-medium">{user.username}</TableCell>
                <TableCell>{user.realName || '-'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.department?.name || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles?.map((role: any) => (
                      <Badge key={role.id} variant="secondary" className="text-xs">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? 'default' : 'destructive'}>
                    {user.isActive ? '启用' : '禁用'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="cursor-pointer">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onEdit(user.id)}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => resetPasswordMutation.mutate(user.id)}
                        className="cursor-pointer"
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        重置密码
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(user.id)}
                        className="cursor-pointer text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data?.total > pageSize && (
        <div className="flex justify-end">
          <Pagination
            total={data.total}
            page={page}
            pageSize={pageSize}
            onChange={setPage}
          />
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复，确认删除该用户？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="cursor-pointer bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 3: 创建用户 Drawer 表单**

`components/users/user-drawer.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';

interface UserDrawerProps {
  open: boolean;
  onClose: () => void;
  userId: string | null;
}

interface UserForm {
  username: string;
  email: string;
  realName: string;
  password?: string;
  departmentId: string;
  roleIds: string[];
  isActive: boolean;
}

export function UserDrawer({ open, onClose, userId }: UserDrawerProps) {
  const queryClient = useQueryClient();
  const isEditing = !!userId;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<UserForm>({ defaultValues: { isActive: true, roleIds: [] } });

  // 获取角色列表
  const { data: roles } = useQuery({
    queryKey: ['roles-all'],
    queryFn: async () => {
      const { data } = await api.get('/roles', { params: { pageSize: 100 } });
      return data.items;
    },
  });

  // 获取部门列表
  const { data: departments } = useQuery({
    queryKey: ['departments-all'],
    queryFn: async () => {
      const { data } = await api.get('/departments');
      return data;
    },
  });

  // 获取编辑用户数据
  const { data: userData } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/${userId}`);
      return data;
    },
    enabled: isEditing && open,
  });

  useEffect(() => {
    if (userData) {
      reset({
        username: userData.username,
        email: userData.email,
        realName: userData.realName || '',
        departmentId: userData.departmentId || '',
        roleIds: userData.roles?.map((r: any) => r.id) || [],
        isActive: userData.isActive,
      });
    } else if (!isEditing) {
      reset({ isActive: true, roleIds: [] });
    }
  }, [userData, isEditing, reset]);

  const mutation = useMutation({
    mutationFn: (data: UserForm) =>
      isEditing ? api.patch(`/users/${userId}`, data) : api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const watchedRoleIds = watch('roleIds') || [];

  const toggleRole = (roleId: string) => {
    const current = watchedRoleIds;
    const updated = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
    setValue('roleIds', updated);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">
            {isEditing ? '编辑用户' : '新增用户'}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? '修改用户信息和角色分配' : '创建新的系统用户'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名 *</Label>
            <Input
              id="username"
              {...register('username', { required: '请输入用户名' })}
              disabled={isEditing}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="password">密码 *</Label>
              <Input
                id="password"
                type="password"
                {...register('password', { required: '请输入密码' })}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">邮箱 *</Label>
            <Input
              id="email"
              type="email"
              {...register('email', { required: '请输入邮箱' })}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="realName">真实姓名</Label>
            <Input id="realName" {...register('realName')} />
          </div>

          <div className="space-y-2">
            <Label>部门</Label>
            <Select
              onValueChange={(value) => setValue('departmentId', value)}
              defaultValue={watch('departmentId')}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="选择部门" />
              </SelectTrigger>
              <SelectContent>
                {departments?.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id} className="cursor-pointer">
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>角色</Label>
            <div className="rounded-lg border p-3 space-y-2">
              {roles?.map((role: any) => (
                <div key={role.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={watchedRoleIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                    className="cursor-pointer"
                  />
                  <label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer">
                    {role.name}
                    {role.description && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {role.description}
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={watch('isActive')}
              onCheckedChange={(checked) => setValue('isActive', !!checked)}
              className="cursor-pointer"
            />
            <label htmlFor="isActive" className="text-sm cursor-pointer">启用账号</label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 cursor-pointer"
            >
              {mutation.isPending ? '保存中...' : '保存'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              取消
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 4: 创建筛选器组件**

`components/users/user-filters.tsx`:
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

interface UserFiltersProps {
  filters: { keyword: string; departmentId: string };
  onFiltersChange: (filters: { keyword: string; departmentId: string }) => void;
}

export function UserFilters({ filters, onFiltersChange }: UserFiltersProps) {
  const { data: departments } = useQuery({
    queryKey: ['departments-all'],
    queryFn: async () => {
      const { data } = await api.get('/departments');
      return data;
    },
  });

  return (
    <div className="flex gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索用户名、邮箱..."
          value={filters.keyword}
          onChange={(e) => onFiltersChange({ ...filters, keyword: e.target.value })}
          className="pl-9"
        />
      </div>
      <Select
        value={filters.departmentId || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, departmentId: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-40 cursor-pointer">
          <SelectValue placeholder="全部部门" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="cursor-pointer">全部部门</SelectItem>
          {departments?.map((dept: any) => (
            <SelectItem key={dept.id} value={dept.id} className="cursor-pointer">
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add clients/admin-web/app/\(dashboard\)/users clients/admin-web/components/users
git commit -m "feat: add user management page with table and drawer"
```

---

### Task 6: 角色管理页面

**Files:**
- Create: `clients/admin-web/app/(dashboard)/roles/page.tsx`
- Create: `clients/admin-web/components/roles/role-table.tsx`
- Create: `clients/admin-web/components/roles/role-drawer.tsx`
- Create: `clients/admin-web/components/roles/permission-tree.tsx`

**Step 1: 创建角色管理主页面**

`app/(dashboard)/roles/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoleTable } from '@/components/roles/role-table';
import { RoleDrawer } from '@/components/roles/role-drawer';

export default function RolesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground">角色管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理角色及其权限分配</p>
        </div>
        <Button
          onClick={() => { setEditingRole(null); setDrawerOpen(true); }}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          新增角色
        </Button>
      </div>

      <RoleTable
        onEdit={(id) => { setEditingRole(id); setDrawerOpen(true); }}
      />

      <RoleDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        roleId={editingRole}
      />
    </div>
  );
}
```

**Step 2: 创建权限树组件（Checkbox 树形结构，按 module 分组）**

`components/roles/permission-tree.tsx`:
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description?: string;
}

interface PermissionTreeProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function PermissionTree({ selectedIds, onChange }: PermissionTreeProps) {
  const { data: permissions } = useQuery({
    queryKey: ['permissions-all'],
    queryFn: async () => {
      const { data } = await api.get('/permissions', { params: { pageSize: 200 } });
      return data.items as Permission[];
    },
  });

  // 按 module 分组
  const grouped = permissions?.reduce<Record<string, Permission[]>>((acc, perm) => {
    const mod = perm.module || 'other';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {}) ?? {};

  const togglePermission = (id: string) => {
    const updated = selectedIds.includes(id)
      ? selectedIds.filter((p) => p !== id)
      : [...selectedIds, id];
    onChange(updated);
  };

  const toggleModule = (modulePerms: Permission[]) => {
    const moduleIds = modulePerms.map((p) => p.id);
    const allSelected = moduleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !moduleIds.includes(id)));
    } else {
      const newIds = [...new Set([...selectedIds, ...moduleIds])];
      onChange(newIds);
    }
  };

  return (
    <div className="rounded-lg border divide-y">
      {Object.entries(grouped).map(([module, perms]) => {
        const moduleIds = perms.map((p) => p.id);
        const allSelected = moduleIds.every((id) => selectedIds.includes(id));
        const someSelected = moduleIds.some((id) => selectedIds.includes(id));

        return (
          <div key={module} className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id={`module-${module}`}
                checked={allSelected}
                data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                onCheckedChange={() => toggleModule(perms)}
                className="cursor-pointer"
              />
              <label
                htmlFor={`module-${module}`}
                className="text-sm font-semibold uppercase tracking-wide text-primary cursor-pointer"
              >
                {module}
              </label>
            </div>
            <div className="ml-6 grid grid-cols-2 gap-1">
              {perms.map((perm) => (
                <div key={perm.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${perm.id}`}
                    checked={selectedIds.includes(perm.id)}
                    onCheckedChange={() => togglePermission(perm.id)}
                    className="cursor-pointer"
                  />
                  <label
                    htmlFor={`perm-${perm.id}`}
                    className="text-xs cursor-pointer"
                    title={perm.description}
                  >
                    <span className="font-mono text-muted-foreground">{perm.code}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: 创建角色 Drawer**

`components/roles/role-drawer.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionTree } from './permission-tree';
import api from '@/lib/api';

interface RoleDrawerProps {
  open: boolean;
  onClose: () => void;
  roleId: string | null;
}

interface RoleForm {
  name: string;
  description: string;
  permissionIds: string[];
}

export function RoleDrawer({ open, onClose, roleId }: RoleDrawerProps) {
  const queryClient = useQueryClient();
  const isEditing = !!roleId;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<RoleForm>({ defaultValues: { permissionIds: [] } });

  const { data: roleData } = useQuery({
    queryKey: ['role', roleId],
    queryFn: async () => {
      const { data } = await api.get(`/roles/${roleId}`);
      return data;
    },
    enabled: isEditing && open,
  });

  useEffect(() => {
    if (roleData) {
      reset({
        name: roleData.name,
        description: roleData.description || '',
        permissionIds: roleData.permissions?.map((p: any) => p.id) || [],
      });
    } else if (!isEditing) {
      reset({ permissionIds: [] });
    }
  }, [roleData, isEditing, reset]);

  const mutation = useMutation({
    mutationFn: (data: RoleForm) =>
      isEditing ? api.patch(`/roles/${roleId}`, data) : api.post('/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono">
            {isEditing ? '编辑角色' : '新增角色'}
          </SheetTitle>
          <SheetDescription>配置角色名称和权限</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">角色名称 *</Label>
            <Input
              id="name"
              {...register('name', { required: '请输入角色名称' })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Input id="description" {...register('description')} />
          </div>

          <div className="space-y-2">
            <Label>权限分配</Label>
            <PermissionTree
              selectedIds={watch('permissionIds')}
              onChange={(ids) => setValue('permissionIds', ids)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 cursor-pointer"
            >
              {mutation.isPending ? '保存中...' : '保存'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              取消
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 4: 创建角色表格**

`components/roles/role-table.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/api';

interface RoleTableProps {
  onEdit: (id: string) => void;
}

export function RoleTable({ onEdit }: RoleTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/roles', { params: { pageSize: 100 } });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>角色名称</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>权限数量</TableHead>
              <TableHead>用户数量</TableHead>
              <TableHead className="w-12">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items?.map((role: any) => (
              <TableRow key={role.id}>
                <TableCell className="font-mono font-medium">{role.name}</TableCell>
                <TableCell className="text-muted-foreground">{role.description || '-'}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{role._count?.permissions ?? 0}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{role._count?.users ?? 0}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="cursor-pointer">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onEdit(role.id)}
                        className="cursor-pointer"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(role.id)}
                        className="cursor-pointer text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除角色将解除所有用户与该角色的关联，确认继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="cursor-pointer bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 5: Commit**

```bash
git add clients/admin-web/app/\(dashboard\)/roles clients/admin-web/components/roles
git commit -m "feat: add role management page with permission tree"
```

---

### Task 7: 权限列表页面

**Files:**
- Create: `clients/admin-web/app/(dashboard)/permissions/page.tsx`

**Step 1: 创建权限列表页面（只读，按模块分组展示）**

`app/(dashboard)/permissions/page.tsx`:
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description?: string;
}

export default function PermissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['permissions-all'],
    queryFn: async () => {
      const { data } = await api.get('/permissions', { params: { pageSize: 200 } });
      return data.items as Permission[];
    },
  });

  const grouped = data?.reduce<Record<string, Permission[]>>((acc, perm) => {
    const mod = perm.module || 'other';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">权限管理</h2>
        <p className="text-sm text-muted-foreground mt-1">
          系统权限列表，共 {data?.length ?? 0} 项，按模块分组显示
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          加载中...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(grouped).map(([module, perms]) => (
            <Card key={module} className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-mono uppercase">
                  <Shield className="h-4 w-4 text-primary" />
                  {module}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {perms.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {perms.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-start justify-between rounded-md px-2 py-1 hover:bg-muted/50 transition-colors duration-150"
                    >
                      <div>
                        <p className="text-xs font-mono text-primary">{perm.code}</p>
                        <p className="text-xs text-muted-foreground">{perm.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add clients/admin-web/app/\(dashboard\)/permissions
git commit -m "feat: add permissions list page grouped by module"
```

---

### Task 8: 个人信息页面

**Files:**
- Create: `clients/admin-web/app/(dashboard)/profile/page.tsx`

**Step 1: 创建个人信息页面**

`app/(dashboard)/profile/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface ProfileForm {
  realName: string;
  email: string;
  phone?: string;
}

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>({
    defaultValues: {
      realName: user?.realName || '',
      email: user?.email || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch: watchPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>();

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/profile', data),
    onSuccess: ({ data }) => {
      setUser({ ...user!, ...data });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) => api.post('/auth/change-password', data),
    onSuccess: () => {
      resetPassword();
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">个人信息</h2>
        <p className="text-sm text-muted-foreground mt-1">管理您的账号信息和安全设置</p>
      </div>

      {/* 账号概览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold font-mono">
              {user?.username[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{user?.realName || user?.username}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-1 mt-1">
                {user?.roles?.map((role: any) => (
                  <Badge key={role.id} variant="secondary" className="text-xs">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            基本信息
          </CardTitle>
          <CardDescription>更新您的个人资料</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleProfileSubmit((data) => profileMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input value={user?.username} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="realName">真实姓名</Label>
              <Input id="realName" {...registerProfile('realName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                {...registerProfile('email', { required: '请输入邮箱' })}
              />
              {profileErrors.email && (
                <p className="text-xs text-destructive">{profileErrors.email.message}</p>
              )}
            </div>

            {profileSuccess && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                个人信息已更新
              </div>
            )}

            <Button
              type="submit"
              disabled={profileMutation.isPending}
              className="cursor-pointer"
            >
              {profileMutation.isPending ? '保存中...' : '保存修改'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            修改密码
          </CardTitle>
          <CardDescription>定期更换密码以保护账号安全</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handlePasswordSubmit((data) => passwordMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="oldPassword">当前密码</Label>
              <Input
                id="oldPassword"
                type="password"
                {...registerPassword('oldPassword', { required: '请输入当前密码' })}
              />
              {passwordErrors.oldPassword && (
                <p className="text-xs text-destructive">{passwordErrors.oldPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                {...registerPassword('newPassword', {
                  required: '请输入新密码',
                  minLength: { value: 8, message: '密码至少 8 位' },
                })}
              />
              {passwordErrors.newPassword && (
                <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...registerPassword('confirmPassword', {
                  required: '请确认新密码',
                  validate: (value) =>
                    value === watchPassword('newPassword') || '两次密码输入不一致',
                })}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            {passwordSuccess && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                密码已修改成功
              </div>
            )}

            <Button
              type="submit"
              disabled={passwordMutation.isPending}
              className="cursor-pointer"
            >
              {passwordMutation.isPending ? '修改中...' : '修改密码'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add clients/admin-web/app/\(dashboard\)/profile
git commit -m "feat: add profile page with info editing and password change"
```

---

## 阶段四：路由保护和收尾

### Task 9: 添加路由守卫和 QueryProvider

**Files:**
- Create: `clients/admin-web/middleware.ts`
- Create: `clients/admin-web/components/providers.tsx`
- Modify: `clients/admin-web/app/layout.tsx`

**Step 1: 创建中间件（路由守卫）**

`middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查 cookie 中的 token（服务端可读）
  const token = request.cookies.get('accessToken')?.value;

  // 已登录用户访问 /login，重定向到 dashboard
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 未登录用户访问 /dashboard/*，重定向到登录
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/dashboard/:path*'],
};
```

**Step 2: 创建 Providers 组件**

`components/providers.tsx`:
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 3: 更新根布局**

`app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'RBAC Admin',
  description: 'RBAC 权限管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 4: 在登录时写入 cookie（配合中间件）**

在 `lib/api.ts` 的登录成功响应拦截中，同步写入 cookie：

```typescript
// 在登录成功后调用（lib/auth.ts 中添加）
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  // 写入 cookie 供中间件读取
  document.cookie = `accessToken=${accessToken}; path=/; max-age=3600`;
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  document.cookie = 'accessToken=; path=/; max-age=0';
}
```

**Step 5: 最终构建验证**

```bash
bun run build
bun run lint
```

Expected: 无 TypeScript 错误，无 ESLint 错误

**Step 6: Commit**

```bash
git add clients/admin-web
git commit -m "feat: add route guard middleware and React Query provider"
```

---

## 验收标准

### 功能验收
- [ ] 登录成功后跳转到 /dashboard
- [ ] 未登录访问 /dashboard/* 自动跳转 /login
- [ ] 侧边栏根据权限动态显示菜单
- [ ] 用户管理：列表、新增、编辑、删除、重置密码
- [ ] 角色管理：列表、新增、编辑、删除、分配权限（Checkbox 树）
- [ ] 权限列表：按模块分组显示（Card 布局）
- [ ] 个人信息：查看、编辑、修改密码

### UI/UX 验收
- [ ] 无 emoji 图标（使用 Lucide React）
- [ ] 所有可点击元素有 cursor-pointer
- [ ] Hover 状态有平滑过渡（150-300ms）
- [ ] 表单有 loading 和 error 状态
- [ ] 响应式：375px, 768px, 1024px, 1440px
- [ ] 键盘导航可用（Tab 顺序正确）

### 性能验收
- [ ] 首屏加载 < 3s
- [ ] 表格分页加载
- [ ] 图片使用 Next.js Image 组件

---

## 执行建议

1. **按阶段执行**：先完成布局，再逐个实现页面
2. **频繁 Commit**：每个 Task 完成后立即 commit
3. **边开发边测试**：每个页面完成后在浏览器中测试
4. **使用 shadcn/ui blocks**：`bunx shadcn@latest add dashboard-01` 快速搭建
5. **API 联调顺序**：登录 -> 用户列表 -> 角色列表 -> 权限列表
