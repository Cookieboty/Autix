# HeroUI 重构 chat-web 设计文档

**日期：** 2026-04-07
**项目：** chat-web → HeroUI 重构
**后续项目：** admin-web（待第二阶段）

---

## 1. 背景与目标

chat-web 当前使用自定义 CSS 变量实现暗色主题，配色为 `#0F0F23` 深色背景 + 自定义 primary/secondary 颜色。用户表示完全不喜欢现有配色，希望迁移到 HeroUI 默认主题体系。

**目标：**
- 使用 HeroUI 内置的 CSS 变量系统（primary/success/danger 等）替代现有自定义颜色
- 移除 next-themes，使用 HeroUI 内置的 dark mode 切换机制
- 将所有 UI 组件替换为 HeroUI 组件
- 保留所有业务逻辑层（API、Store、React Query）

---

## 2. 技术决策

### 2.1 Theme & Design Token

- **方案：** 使用 HeroUI 内置 CSS 变量系统，完全替换现有的 `--background`/`--foreground`/`--primary` 等自定义变量
- **Dark Mode：** 改用 HeroUI 内置暗色模式，移除 `next-themes`
- **配置文件：** `app/globals.css` 重写，`app/layout.tsx` 移除 `ThemeProvider`

### 2.2 组件替换映射

| 现有组件/元素 | HeroUI 替换方案 |
|---|---|
| `components/chat/sidebar.tsx` | HeroUI `Navbar` + `Dropdown` |
| 消息气泡（自写 div） | HeroUI `Card` + `Avatar` |
| 登录/注册表单 | HeroUI `Form` + `Input` + `Button` |
| pending 页面 | HeroUI `Card` + `Button` |
| Toast (sonner) | HeroUI `@heroui/toast` |

### 2.3 保留不变的部分

- `lib/api.ts`、`lib/auth.ts`、`lib/utils.ts`
- `store/auth.store.ts`、`store/chat.store.ts`
- React Query + Zustand 状态管理
- API 路由和业务逻辑

---

## 3. 文件变更清单

### 3.1 需要修改的文件

| 文件 | 改动内容 |
|---|---|
| `app/globals.css` | 删除自定义 CSS 变量，引入 HeroUI theme |
| `app/layout.tsx` | 移除 next-themes ThemeProvider，添加 HeroUI `KProvider` |
| `app/login/page.tsx` | 重写为 HeroUI Form + Input + Button |
| `app/register/page.tsx` | 重写为 HeroUI Form + Input + Button |
| `app/pending/page.tsx` | 重写为 HeroUI Card + Button |
| `app/(chat)/layout.tsx` | 重写聊天布局框架 |
| `app/(chat)/page.tsx` | 重写聊天消息区 |
| `components/chat/sidebar.tsx` | 重写侧边栏为 HeroUI Navbar |

### 3.2 新建的文件

| 文件 | 用途 |
|---|---|
| `components/chat/MessageBubble.tsx` | 消息气泡组件（用户/AI 两种样式） |
| `components/chat/ChatInput.tsx` | 聊天输入框组件 |
| `components/chat/SessionList.tsx` | 侧边栏会话列表组件 |

---

## 4. 改造顺序

1. **Step 1：** 安装 `@heroui/react` + 依赖，配置 `globals.css` 和 `layout.tsx`（验证 HeroUI 正常运行）
2. **Step 2：** 重写登录/注册/pending 三个简单页面（验证 HeroUI 主题和基础组件）
3. **Step 3：** 重写聊天布局 `(chat)/layout.tsx` 和侧边栏
4. **Step 4：** 重写消息气泡组件和聊天页面
5. **Step 5：** 替换 Toast（如果用了 Sonner）

---

## 5. HeroUI 配置要点

### 5.1 globals.css

```css
@import "tailwindcss";
@import "@heroui/react/theme";

/* 不需要其他自定义变量，HeroUI 自动注入 primary/success/danger 等 */
```

### 5.2 layout.tsx

HeroUI v3 需要在 root layout 中包裹 `KProvider`（HeroUI 的 provider）。

### 5.3 Dark Mode

HeroUI 使用 `data-theme="dark"` 属性切换暗色模式。需要在 html 元素上设置 `data-theme="dark"`。

---

## 6. admin-web（第二阶段）

待 chat-web 完成后，使用相同策略改造 admin-web：
- 移除 shadcn/ui 的 CSS 变量，引入 HeroUI theme
- 替换 shadcn/ui 组件为 HeroUI 对应组件
- 移除 next-themes，使用 HeroUI 内置 dark mode
- 保留业务逻辑和状态管理
