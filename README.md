# Amux Studio

**Think it. Build it. Ship it.**

PRD · 代码 · 设计 · 原型，AI 一站生成。从一句话需求到可交付产品的 AI 产品工作室。

## 项目概览

Bun Workspaces + Turborepo 单仓多包，包含 Web 前端、桌面端、AI 服务、用户系统四个可独立部署的应用，外加共享的 UI / Store / Lib 包。

| 模块 | 描述 | 端口 |
|------|------|------|
| `clients/chat-web` | Next.js 16 前端（首页 + AI 工作台 + 会员中心 + `/system` 管理后台） | 3002 |
| `clients/admin-web` | Next.js 16 用户/角色/权限管理后台 | 3001 |
| `clients/desktop` | Electron 桌面端（复用 shared-ui，HashRouter，自带托盘/全局快捷键/Deep Link/自动更新） | — |
| `services/chat` | NestJS AI 服务（多 Agent + RAG + 多模型对战 + 模板生成 + 图片生成 + 会员积分 + SSE） | 4001 |
| `services/user-system` | NestJS 用户/认证/RBAC 服务（HTTP + gRPC :50051） | 4002 |
| `packages/shared-ui` | 跨端共享 React 组件库（HeroUI 封装：chat / arena / artifact / template / admin / docs / models / ...） | — |
| `packages/shared-store` | 跨端 Zustand stores（auth / chat / arena / artifact / template / ...） | — |
| `packages/shared-lib` | 跨端 API 客户端 + 工具函数 + 平台适配器 | — |
| `packages/database` | 用户系统 Prisma Schema + 迁移 + 种子 | — |
| `packages/contracts` | gRPC Proto 定义 + 共享常量 | — |
| `packages/types` | 共享 TypeScript 类型 | — |
| `packages/i18n` | 国际化配置（zh-CN / en / ja / fr / ru / vi / zh-TW） | — |

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 & 包管理 | Bun 1.3 + Workspaces |
| 构建编排 | Turborepo |
| Web 前端 | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + HeroUI |
| 桌面端 | Electron 33 + electron-vite + React 19 + HashRouter |
| 后端 | NestJS 11 + Passport JWT |
| 数据库 | PostgreSQL 16 + Prisma 7 + pgvector |
| 服务间通信 | gRPC（user-system ↔ chat） |
| AI / LLM | LangChain + LangGraph + OpenAI 兼容 API |
| 实时通信 | SSE（Server-Sent Events） |
| 对象存储 | Cloudflare R2（可选，图片/文档） |
| 容器化 | Docker Compose（生产镜像发布到 GHCR） |

## 快速开始

### 前置要求

- [Bun](https://bun.sh) >= 1.3
- [Docker](https://www.docker.com) + Docker Compose
- PostgreSQL 16（用 Docker 启动，或自行安装）

### 1. 安装依赖

```bash
git clone <repo-url> amux-studio
cd amux-studio
bun install
```

### 2. 启动数据库

```bash
# 启动 PostgreSQL（含 pgvector），自动创建 user_system / autix_chat 两个库
docker compose up postgres -d
```

如果使用已有 PostgreSQL，手动执行：

```sql
CREATE DATABASE user_system;
CREATE DATABASE autix_chat;
\c autix_chat
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. 配置环境变量

所有环境变量收敛到根目录 `.env`，子包通过 `dotenv-cli` 注入（`dotenv -e ../../.env -- ...`），无需在子目录单独配置。

```bash
cp .env.example .env
```

**关键变量：**

| 变量 | 说明 |
|------|------|
| `CHAT_DATABASE_URL` | chat 服务的 PostgreSQL 连接串 |
| `USER_DATABASE_URL` | user-system 的 PostgreSQL 连接串 |
| `JWT_SECRET` | JWT 签名密钥（>= 32 字符，所有服务共享） |
| `INTERNAL_SECRET` | 服务间内部调用密钥 |
| `USER_GRPC_URL` | chat 调用 user-system 的 gRPC 地址 |
| `USER_CORS_ORIGIN` / `CORS_ORIGIN` | 服务端 CORS 白名单（含 `file://`、`app://desktop` 以支持桌面端） |
| `SUPER_ADMIN_*` | 超管账号（首次启动自动创建，幂等） |
| `NEXT_PUBLIC_CHAT_API_URL` / `NEXT_PUBLIC_USER_API_URL` | 前端访问后端服务的地址 |
| `NEXT_PUBLIC_AMUX_HOST` / `NEXT_PUBLIC_AMUX_CLIENT_ID` | Amux 凭据代理（amux-proxy）配置 |
| `R2_*` / `S3_API` / `Access_key_ID` 等 | Cloudflare R2 对象存储（可选） |

### 4. 初始化数据库

```bash
# 用户系统：建表 + 种子（系统/角色/超管由服务启动时按 SUPER_ADMIN_* 自动创建）
cd packages/database
bunx prisma migrate deploy
bun run db:seed

# Chat 服务：建表 + 会员积分种子
cd ../../services/chat
bunx prisma migrate deploy
bunx prisma generate
bun run seed:membership
# 可选：提示词模板种子
bun run seed:templates
```

### 5. 启动开发环境

```bash
# 回到根目录
bun run dev
```

Turborepo 按依赖顺序启动：

| 服务 | 地址 |
|------|------|
| user-system | http://localhost:4002 + gRPC :50051 |
| chat | http://localhost:4001 |
| chat-web | http://localhost:3002 |
| admin-web | http://localhost:3001 |

桌面端单独启动（依赖 chat / user-system 已就绪）：

```bash
bun run dev:desktop
```

## Docker 一键部署

生产镜像已发布到 GHCR（`ghcr.io/cookieboty/autix-{user-system,chat,chat-web}:latest`）。

```bash
cp .env.example .env   # 填好 JWT_SECRET / POSTGRES_PASSWORD / SUPER_ADMIN_*
docker compose up -d
```

启动顺序：`postgres` → `user-system` → `chat` → `chat-web`，全部带 healthcheck 自动等待。

## 核心功能

### AI 产品工作室（多 Agent Pipeline）

```
用户输入需求
  ↓
extractAgent     结构化 JSON（需求类型 / 核心功能 / 目标用户）
  ↓
clarifyAgent     判断是否需要澄清，不完整则追问
  ↓
analysisAgent ┐  功能分解 / 用户故事 / 验收标准
riskAgent     ┘  风险评估（技术 / 范围 / 业务） — 并行
  ↓
summaryAgent     综合报告（含 RAG 知识库引用）
  ↓
SSE 流式推送 Markdown
```

### AI 动态 UI 协议（`llm/ui-protocol`）

模型按场景返回结构化的 UI 组件指令（`form` / `selection` / `card` / `table` / `confirmation` / `steps` / `action_buttons` / `text`），前端按 schema 渲染交互组件，让对话能直接驱动表单、确认、进度、表格。

### 多模型对战（Arena）

同一 Prompt 同时打到多个模型，并排查看响应、做 A/B 评估。对应 `arena_sessions / arena_turns / arena_responses`。

### 提示词模板（Template）

社区/个人提示词模板的发布、订阅、运行；运行结果记录到 `template_generations / generation_turns`。

### Artifacts

每个会话可关联一个 Artifact（Markdown / 代码 / 文档），自动按版本归档（`artifact_versions`），支持回滚和按 tag 过滤。

### 会员积分系统

- **三档会员**：Plus / Pro / Ultra，月/季/年 + 连续订阅
- **数据库驱动计费**：等级、价格、积分、折扣全部可在 `/system` 管理后台配置
- **首单折扣** + **积分加油包**（独立购买）
- **按任务类型扣减积分**（`task_point_costs` 配置，`task_events` 记录）
- **邀请系统**：每人固定 aff 码，被邀请方注册并审批通过后双方获积分
- **完整订单流程**：下单 → 支付 → 履约

### 用户权限系统

- **多系统架构**：System → Role → Menu → Permission
- **注册审批**：用户注册 → 管理员审批（chat 后台可直接审批）
- **gRPC 通信**：chat 通过 `CheckAdmin / ListUsers / ApproveUser` 调用 user-system

### 桌面端

- 复用 chat-web 的全部业务（共享 `shared-ui` / `shared-store` / `shared-lib`）
- 主进程能力：托盘、全局快捷键、Deep Link（`autix://`）、单实例锁、自动更新（GHCR Releases）、原生通知
- 跨平台打包：`bun --filter @autix/desktop dist:mac` / `dist:win` / `dist:linux`

## 常用命令

```bash
# 开发
bun run dev              # 启动 Web 前后端
bun run dev:chat-web     # 仅前端
bun run dev:chat         # 仅 chat 服务
bun run dev:desktop      # 仅桌面端

# 构建 & 检查
bun run build            # 构建所有包
bun run typecheck        # TypeScript 类型检查
bun run clean:ports      # 终止占用 3001/3002/4001/4002 的进程

# 数据库
cd packages/database && bunx prisma studio    # 用户系统 DB GUI
cd services/chat && bunx prisma studio        # Chat DB GUI

# 种子
cd packages/database && bun run db:seed
cd services/chat && bun run seed:membership
cd services/chat && bun run seed:templates
```

## 数据库

两个独立 PostgreSQL 数据库。

**`user_system`**（`packages/database`）
System / User / Role / UserRole / Menu / Permission / SystemRegistration（含 inviteCode）/ UserSession / OAuthClient

**`autix_chat`**（`services/chat`）
- 会话与产物：`conversations` / `messages` / `artifacts` / `artifact_versions`
- 知识库：`documents` / `document_chunks`（pgvector）
- 模型与任务：`model_configs` / `task_events`
- 多模型对战：`arena_sessions` / `arena_turns` / `arena_responses`
- 提示词模板：`prompt_templates` / `template_generations` / `generation_turns`
- 会员积分：`membership_levels` / `membership_plans` / `user_memberships` / `points_packages` / `user_points` / `points_records`
- 订单与邀请：`orders` / `invite_codes` / `invite_records` / `task_point_costs`
- Amux 凭据代理：`amux_credentials`

## License

MIT
