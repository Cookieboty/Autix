# Autix

全栈 Monorepo 项目，包含 AI 需求分析助手（多 Agent + RAG）、用户权限系统（RBAC + 多系统）、管理后台和前端应用。基于 **Bun + Turborepo** 构建。

## 项目概览

| 模块 | 描述 | 端口 |
|------|------|------|
| `clients/chat-web` | Next.js AI 需求分析助手前端 | 3002 |
| `clients/admin-web` | Next.js 管理后台（用户/角色/权限） | 3001 |
| `services/chat` | NestJS AI 服务（RAG + 多 Agent 编排 + SSE） | 4001 |
| `services/user-system` | NestJS 用户/认证/RBAC 服务 | 4002 |
| `packages/types` | 跨包共享 TypeScript 类型 | — |
| `packages/contracts` | 共享 Zod 验证 Schema | — |

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理 | Bun 1.3.11 + Workspaces |
| 构建编排 | Turborepo 2.8 |
| 前端 | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui + Zustand |
| 后端 | NestJS 11 + Passport JWT |
| 数据库 | PostgreSQL + Prisma ORM |
| 向量检索 | pgvector（内嵌 PostgreSQL） |
| AI/LLM | LangChain + OpenAI 兼容 API（GPT-4o 等） |
| 文档解析 | PDF（pdf-parse）+ DOCX（mammoth）+ TXT |
| 容器化 | Docker Compose |

## 目录结构

```
autix/
├── clients/
│   ├── chat-web/          # Next.js AI 助手前端（端口 3002）
│   └── admin-web/         # Next.js 管理后台（端口 3001）
├── services/
│   ├── chat/              # NestJS AI 服务（端口 4001）
│   │   ├── src/
│   │   │   ├── conversation/   # 会话 CRUD + SSE chat 端点
│   │   │   ├── document/        # 文档上传、解析、向量化
│   │   │   ├── llm/
│   │   │   │   ├── agents/      # 5 个 Agent 链 + Orchestrator
│   │   │   │   └── prompts/     # 所有 LLM 提示词（统一管理）
│   │   │   ├── message/         # 消息持久化
│   │   │   └── sse/             # SSE 任务事件推送
│   │   └── prisma/
│   │       └── schema.prisma    # 会话、消息、文档、DocumentChunk、TaskEvent
│   └── user-system/      # NestJS 用户权限服务（端口 4002）
│       └── src/
│           ├── auth/           # JWT 登录/注册/刷新/登出
│           ├── user/           # 用户 CRUD + 状态管理
│           ├── role/           # 角色 + 菜单/权限关联
│           ├── menu/           # 菜单树 CRUD
│           ├── permission/     # 权限 CRUD
│           ├── system/          # 多系统管理
│           ├── registration/   # 用户注册 + 审批流程
│           └── session/         # 会话查看与撤销
├── packages/
│   ├── database/           # Prisma Schema 定义（用户系统 DB）
│   ├── types/             # 共享 TypeScript 类型（ApiResponse / ErrorCode 等）
│   └── contracts/         # 共享 Zod 验证 Schema
├── infra/compose/         # Docker Compose 配置（PostgreSQL + pgvector）
├── turbo.json             # Turborepo 任务图
└── package.json           # Workspaces 根配置
```

## 快速开始

### 前置要求

- [Bun](https://bun.sh) >= 1.3.11
- [Docker](https://www.docker.com) + Docker Compose

### 1. 安装依赖

```bash
bun install
```

### 2. 启动数据库（PostgreSQL + pgvector）

```bash
cd infra/compose
docker compose -f compose.dev.yaml up -d
```

这会启动：
- `autix_postgres` — PostgreSQL 16 + pgvector 扩展（端口 5432）
- `autix_qdrant` — Qdrant 向量数据库（端口 6333，可选）

### 3. 配置环境变量

```bash
# services/chat/.env
cp services/chat/.env.example services/chat/.env
# 编辑 .env，填入 OPENAI_API_KEY / OPENAI_BASE_URL 等

# services/user-system/.env
cp services/user-system/.env.example services/user-system/.env
# 编辑 .env，填入 DATABASE_URL / JWT_SECRET 等

# packages/database/.env
cp packages/database/.env.example packages/database/.env
```

**关键环境变量说明：**

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API Key（或兼容 provider） |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 端点（如 `https://api.amux.ai/v1`） |
| `DATABASE_URL` | PostgreSQL 连接串（`postgresql://...`） |
| `JWT_SECRET` | JWT 签名密钥（>= 32 字符） |
| `VECTOR_DB_URL` | Qdrant 地址（默认 `http://localhost:6333`） |

### 4. 初始化数据库

```bash
# 用户系统 DB（packages/database）
cd packages/database
bunx prisma migrate dev
bun run seed        # 预置系统、角色、用户

# AI 服务 DB（services/chat）
cd services/chat
bunx prisma migrate dev
```

### 5. 启动开发服务

```bash
bun run dev
```

Turborepo 会按依赖顺序启动所有服务：

```
# chat-web    → http://localhost:3002   (AI 助手前端)
# admin-web   → http://localhost:3001   (管理后台)
# chat        → http://localhost:4001   (AI 服务 API)
# user-system → http://localhost:4002   (用户/认证 API)
```

### 常用脚本

```bash
bun run build        # 构建所有包
bun run typecheck    # TypeScript 类型检查
bun run clean:ports  # 终止占用 3001/3002/4001/4002 端口的进程
```

## 核心功能说明

### AI 需求分析助手（chat 服务）

用户发送需求后，服务端通过 **多 Agent 编排流水线** 产出结构化分析报告：

```
用户消息
  │
  ▼
Step 1: extractAgent    ──→ 结构化 JSON（需求类型/核心功能/目标用户/…）
  │
  ▼
Step 2: clarifyAgent    ──→ 判断是否需要澄清（isComplete=false → 追问）
  │（需要澄清 → 直接返回问题列表，不继续）
  ▼
Step 3: Promise.all([
          analysisAgent,   ──→ Markdown：功能分解 / 用户故事 / 验收标准 / 依赖关系 / 实现建议
          riskAgent,       ──→ Markdown：模糊性风险 / 范围风险 / 技术风险 / 业务风险 / 规格缺失
        ])
  │
  ▼
Step 4: summaryAgent     ──→ Markdown 报告（需求概述 + 多维度分析 + 风险评估 + 知识库参考 + 综合建议）
  │
  ▼
SSE 推送（逐行 Markdown + 结构化 summary 事件 + [DONE]）
```

**RAG（检索增强生成）：** 每次请求前会用 pgvector 向量检索匹配用户文档，取 topK（如 5 条）作为 `retrievedContext` 注入 `summaryAgent`，使报告能引用用户上传的参考文档。

**SSE 推送格式：**
```
data: ## 需求分析报告
data:
data: ### 一、需求概述
data: ...
data: {"type":"summary","usedAgents":[...],"retrievedDocuments":[...],"needsClarification":false,"clarificationQuestions":[]}
data: [DONE]
```

### 文档管理（chat 服务）

- 支持 PDF / DOCX / TXT 上传（单文件 <= 10MB）
- 后台异步解析文本 → 分块（chunk）→ 向量化（pgvector embedding）
- SSE 推送处理进度（`status: processing` → `status: done/error`）
- 支持删除文档（级联删除 chunks 和向量数据）

### 用户权限系统（user-system 服务）

- **多系统架构**：每个 `System` 独立管理自己的用户、角色、菜单、权限
- **三级 RBAC**：System → Menu（树形菜单）→ Permission（前端/后端权限）
- **注册审批流程**：用户提交注册申请 → 系统管理员审批/拒绝
- **JWT 会话管理**：支持查看所有活跃会话、单独撤销会话
- **PermissionsGuard**：基于装饰器的接口级权限控制

### 管理后台（admin-web）

- 用户管理（CRUD、重置密码、状态管理）
- 角色管理（CRUD + 分配菜单 + 分配权限）
- 权限中心（系统/菜单/权限树形结构可视化）
- 个人中心（个人信息、修改密码）

## LLM 提示词管理

所有 LLM 提示词收敛在 `services/chat/src/llm/prompts/` 统一管理：

```
src/llm/prompts/
├── index.ts              # 统一导出
├── llm.prompts.ts        # 通用助手提示词
└── requirement.prompts.ts # 5 个需求分析 Agent 提示词
                            # extractPrompt / clarifyPrompt / analysisPrompt
                            # riskPrompt / summaryPrompt
```

Agent 链定义（`agents/sub-agents.ts`）只负责 `pipe(model).pipe(parser)` 组链，提示词内容与链构建逻辑完全分离。

## API 概览

### chat 服务（端口 4001）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/conversations` | 创建会话 |
| `GET` | `/api/conversations` | 列出用户所有会话 |
| `GET` | `/api/conversations/:id/messages` | 获取会话消息历史 |
| `DELETE` | `/api/conversations/:id` | 删除会话 |
| `POST` | `/api/conversations/:id/chat` | **SSE 聊天**（核心端点） |
| `POST` | `/api/documents/upload` | 上传文档 |
| `POST` | `/api/documents/:id/process` | 触发文档解析/向量化 |
| `GET` | `/api/documents` | 列出用户文档 |
| `GET` | `/api/documents/:id` | 获取文档详情 |
| `DELETE` | `/api/documents/:id` | 删除文档 |
| `POST` | `/api/search` | pgvector 语义检索 |
| `GET` | `/api/sse/tasks` | SSE 推送任务处理进度 |
| `GET` | `/api/tasks/history` | 任务历史 |
| `PATCH` | `/api/tasks/:taskId/read` | 标记任务为已读 |

### user-system 服务（端口 4002，路径前缀 `/api`）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/login` | 登录 |
| `POST` | `/auth/register` | 注册 |
| `POST` | `/auth/refresh` | 刷新 Token |
| `POST` | `/auth/logout` | 登出 |
| `GET` | `/auth/profile` | 当前用户信息 |
| `GET` | `/users` | 用户列表 |
| `POST` | `/users` | 创建用户 |
| `PUT` | `/users/:id/status` | 更新用户状态 |
| `GET` | `/roles` | 角色列表 |
| `POST` | `/roles` | 创建角色 |
| `PUT` | `/roles/:id/menus` | 分配菜单 |
| `PUT` | `/roles/:id/permissions` | 分配权限 |
| `GET` | `/menus` | 菜单列表 |
| `POST` | `/registrations` | 注册申请列表 |
| `PUT` | `/registrations/:id/approve` | 审批通过 |
| `PUT` | `/registrations/:id/reject` | 审批拒绝 |
| `GET` | `/sessions` | 当前用户会话列表 |
| `DELETE` | `/sessions/:id` | 撤销指定会话 |

## 数据库

两个独立的 PostgreSQL 数据库：

**`user_system`**（packages/database）— 用户权限系统：
- System / User / Role / UserRole
- Menu（树形）/ Permission / RoleMenu / RolePermission
- UserSession / UserAccount / OAuthClient
- SystemRegistration（注册审批）

**`autix_chat`**（services/chat）— AI 服务：
- Conversation / Message（含 metadata JSON 列）
- Document / DocumentChunk（含 pgvector `vector(384)` embedding 列）
- TaskEvent（异步任务状态跟踪）

## License

MIT
