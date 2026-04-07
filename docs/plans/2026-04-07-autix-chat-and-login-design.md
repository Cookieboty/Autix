# Autix Chat & Login Redesign Design Doc

**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** admin-web login redesign + new clients/chat-web + services/chat JWT auth

---

## Overview

Three parallel work items:

1. **admin-web login page redesign** — Enterprise split-screen layout
2. **New `clients/chat-web` app** — Standalone AI chat frontend with separate login
3. **`services/chat` JWT Guard** — Protect all LLM endpoints with user-system JWT

---

## Architecture

```
admin-web (Next.js, port: 3001)
  /login   ← Enterprise split-screen (redesigned)
  /        ← Dashboard (existing, unchanged)
  /users, /roles, /departments, /permission-center ← unchanged

chat-web (Next.js, port: 3002) [NEW]
  /login   ← AI-themed split-screen login
  /        ← Main chat interface (3-column layout)

services/user-system (NestJS, port: 3000)
  POST /auth/login     ← Both frontends call this
  GET  /auth/profile
  POST /auth/refresh
  JWT_SECRET shared

services/chat (NestJS, port: 4001)
  [ALL ENDPOINTS] ← Protected by JwtAuthGuard (new)
  POST /chat/langchain/stream  ← Primary endpoint for chat-web
  POST /chat/langchain/invoke
```

---

## Design System

### admin-web
- **Typography:** Fira Sans (body) + Fira Code (mono/headings) — already in place
- **Colors:** Existing OKLCH design system (blue-purple primary, light+dark modes)
- **Style:** Enterprise, professional, light mode default with dark toggle

### chat-web
- **Typography:** Inter (all text) — clean, minimal, AI-native
- **Colors:** Dark-first — `#0F0F23` background, `#4338CA` secondary, `#22C55E` CTA accent
- **Style:** AI-Native UI — minimal chrome, dark, streaming-optimized
- **Effects:** Typing indicators (3-dot pulse), cursor blink for streaming text, smooth message reveals

---

## Component Designs

### 1. admin-web Login Page (`/login`)

**Layout:** Split screen (45% | 55%)

**Left panel (45%):**
- Background: CSS gradient `from-indigo-600 via-purple-600 to-blue-700`
- Overlay: subtle SVG grid pattern (opacity 0.1)
- Floating geometric shapes (CSS animation, slow drift)
- Content:
  - Autix logo mark + "Admin Console" wordmark
  - 4 feature bullets with CheckCircle icons (Lucide):
    - 统一身份认证
    - 细粒度权限控制
    - 多系统接入
    - 实时审计日志
  - Version badge `v2.0.0` at bottom

**Right panel (55%):**
- Background: `bg-background` (white/dark adaptive)
- Centered `max-w-md` card (no card border, just spacing)
- "Autix" title + "用户权限管理系统" subtitle
- Form: username + password + submit button
- Error alert below password field
- Preserved logic: `react-hook-form`, axios login, localStorage token, `setUser` store

### 2. chat-web Login Page (`/login`)

**Layout:** Split screen (45% | 55%) — same pattern as admin

**Left panel (45%):**
- Background: `#0F0F23` deep space dark + purple gradient overlay
- Animated particle dots (CSS, subtle)
- AI avatar/robot icon with soft pulse glow
- Content:
  - "Autix AI" logo + "智能需求分析助理" subtitle
  - 3 feature bullets:
    - 流式 AI 对话
    - 需求结构化分析
    - 多会话历史管理
  - Subtle typing animation demo text

**Right panel (55%):**
- Background: slightly lighter dark (`#1a1a2e`)
- Same form structure as admin-web login
- CTA button: green `#22C55E` (AI brand color)
- "开始对话 →" button text instead of "登录"
- Same auth flow: POST to user-system `/auth/login`

### 3. chat-web Main Chat Interface (`/`)

**Layout:** 3-column

```
Header (full width, 56px)
  - "Autix AI" logo | model indicator pill | user avatar + logout

Sidebar (260px, fixed)
  - "+ 新建对话" button (top, primary color)
  - Search input
  - Conversation list grouped by date (Today / Yesterday / Earlier)
    - Each item: title (auto-generated from first message) + timestamp
    - Active: highlighted background
    - Hover: shows delete icon

Main chat area (flex-1)
  - Message list (scrollable, reverse scroll to bottom on new message)
    - AI messages: left-aligned, dark card, AI avatar icon
    - User messages: right-aligned, primary color bubble
    - Streaming state: 3-dot pulse OR cursor blink on last character
  - Welcome state (no messages): centered welcome card
  - Input area (bottom, sticky):
    - Multiline textarea (auto-resize, max 6 lines)
    - Send button (disabled while streaming)
    - Keyboard: Ctrl+Enter to send
```

**Data Flow:**
```typescript
// localStorage structure
interface ChatSession {
  id: string;          // uuid
  title: string;       // auto from first message (first 20 chars)
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Storage key: 'autix_chat_sessions'
// Max sessions: 50 (oldest deleted when exceeded)
```

**API Integration:**
- Endpoint: `POST /chat/langchain/stream` (SSE streaming)
- Parse `text/event-stream` chunks, append to current message
- On stream end: save to localStorage

---

## services/chat JWT Guard

### New Files
```
services/chat/src/auth/
  auth.module.ts       ← Import JwtModule with JWT_SECRET
  jwt.strategy.ts      ← PassportStrategy, validate payload
  jwt-auth.guard.ts    ← AuthGuard('jwt')
```

### Environment
```bash
# services/chat/.env (add)
JWT_SECRET=<same value as user-system JWT_SECRET>
```

### Changes
- `app.module.ts`: import `AuthModule`
- `llm.controller.ts`: add `@UseGuards(JwtAuthGuard)` to class level

### JWT Validation
- chat service only validates tokens, never issues them
- If token invalid/expired: 401 Unauthorized
- Token is refreshed by frontend via user-system `/auth/refresh`

---

## chat-web Project Setup

**Base:** Copy structure from admin-web (Next.js + shadcn/ui + Zustand + React Query + Tailwind)

**Key differences from admin-web:**
- Different `globals.css` color tokens (dark-first)
- Inter font instead of Fira Sans/Code
- No sidebar navigation (replaced by conversation list)
- Different layout component
- Simpler store: just `authStore` (no menus)
- `NEXT_PUBLIC_CHAT_API_URL` points to chat service
- `NEXT_PUBLIC_USER_API_URL` points to user-system

**Dependencies (same as admin-web plus):**
- `react-markdown` — render AI markdown responses
- `react-syntax-highlighter` — code block highlighting

---

## Future: Phase C (DB Persistence)

When ready to add backend persistence:
1. Add Prisma + SQLite/Postgres to `services/chat`
2. Create `conversations` and `messages` tables
3. Replace localStorage calls with API calls (`GET/POST /conversations`)
4. Frontend stays compatible (same data structure)

The localStorage structure is designed to mirror the future DB schema.

---

## Implementation Checklist (Pre-Delivery)

- [ ] No emojis as icons (Lucide SVG only)
- [ ] All clickable elements have `cursor-pointer`
- [ ] Smooth transitions 150-300ms
- [ ] `prefers-reduced-motion` respected for streaming animation
- [ ] Both login pages responsive at 375px (stack vertically), 768px+, 1024px+
- [ ] Dark mode works correctly for both apps
- [ ] JWT token refresh handled (interceptor retries on 401)
- [ ] Streaming abort on navigate away (cleanup `AbortController`)
- [ ] Accessibility: form labels, focus states, keyboard nav
