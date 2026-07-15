# Amux Studio

**Think it. Build it. Ship it.**

PRD · 代码 · 设计 · 原型，AI 一站生成。从一句话需求到可交付产品的 AI 产品工作室。

## 项目概览

pnpm Workspaces + Turborepo 单仓多包，包含 Web 前端、桌面端、统一 API 服务，外加共享的 Domain / SDK / Platform / UI / Store / Database 包。

| 模块 | 描述 | 端口 |
|------|------|------|
| `clients/web` | Next.js 16 前端（首页 + AI 工作台 + 会员中心 + `/admin` 管理后台） | 3100 |
| `clients/desktop` | Electron 桌面端（复用 shared-ui，HashRouter，自带托盘/全局快捷键/Deep Link/自动更新） | — |
| `services/api` | NestJS API 服务（认证/RBAC + 多 Agent + RAG + 多模型对战 + 模板生成 + 图片生成 + 会员积分 + SSE） | 4100 |
| `packages/domain` | 前后端共享领域契约、业务枚举、纯规则和协议类型 | — |
| `packages/sdk` | 类型安全前端 API Client | — |
| `packages/platform` | Web/Desktop 运行时适配（存储、导航、环境注入） | — |
| `packages/shared-ui` | 跨端共享 React 组件库（HeroUI 封装：chat / artifact / template / admin / docs / models / ...） | — |
| `packages/shared-store` | 跨端 Zustand stores（auth / chat / artifact / template / ...） | — |
| `packages/database` | 统一 Prisma Schema + 迁移 + 种子 | — |
| `packages/types` | 共享 TypeScript 类型 | — |
| `packages/i18n` | 国际化配置（zh-CN / en / ja / fr / ru / vi / zh-TW） | — |

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 & 包管理 | Node 22 + pnpm 11 Workspaces |
| 构建编排 | Turborepo |
| Web 前端 | Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS 4 + Radix UI / shadcn |
| 桌面端 | Electron 33 + electron-vite + React 19 + HashRouter |
| 后端 | NestJS 11（SWC 编译）+ Passport JWT |
| 数据库 | PostgreSQL 16 + Prisma 7（driver adapter）+ pgvector |
| AI / LLM | LangChain + LangGraph + OpenAI 兼容 API |
| 实时通信 | SSE（Server-Sent Events） |
| 对象存储 | Cloudflare R2（可选，图片/文档） |
| 测试 | Vitest |
| 容器化 | Docker Compose（生产镜像发布到 GHCR） |

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org) >= 22
- [pnpm](https://pnpm.io) >= 11（`corepack enable pnpm`）
- [Docker](https://www.docker.com) + Docker Compose
- PostgreSQL 16（用 Docker 启动，或自行安装）

### 1. 安装依赖

```bash
git clone <repo-url> amux-studio
cd amux-studio
pnpm install
```

### 2. 启动数据库

```bash
# 启动 PostgreSQL（含 pgvector），自动创建 autix 数据库
docker compose up postgres -d
```

如果使用已有 PostgreSQL，手动执行：

```sql
CREATE DATABASE autix;
\c autix
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
| `DATABASE_URL` | 统一 PostgreSQL 连接串，指向合并后的 `autix` 数据库 |
| `JWT_SECRET` | JWT 签名密钥（>= 32 字符，所有服务共享） |
| `CORS_ORIGIN` | 服务端 CORS 白名单（含 `file://`、`app://desktop` 以支持桌面端） |
| `SUPER_ADMIN_*` | 超管账号（首次启动自动创建，幂等） |
| `API_URL` | Web BFF 反向代理目标，默认 `http://localhost:4100` |
| `NEXT_PUBLIC_AMUX_HOST` / `NEXT_PUBLIC_AMUX_CLIENT_ID` | Amux 凭据代理（amux-proxy）配置 |
| `R2_*` / `S3_API` / `Access_key_ID` 等 | Cloudflare R2 对象存储（可选） |

### 4. 初始化数据库

```bash
pnpm --filter @autix/api run db:deploy
pnpm --filter @autix/api run db:push
pnpm --filter @autix/api run db:flat-migrate  # 仅 RUN_FLAT_MIGRATION=true 时执行旧库平迁
pnpm --filter @autix/api run db:seed
pnpm --filter @autix/api run seed:membership
pnpm --filter @autix/api run seed:templates
pnpm --filter @autix/api run seed:resources
```

### 5. 启动开发环境

```bash
# 回到根目录
pnpm run dev
```

Turborepo 按依赖顺序启动：

| 服务 | 地址 |
|------|------|
| API | http://localhost:4100 |
| Web | http://localhost:3100 |

桌面端单独启动（依赖 API 已就绪）：

```bash
pnpm run dev:desktop
```

## Docker 一键部署

生产镜像已发布到 GHCR（`ghcr.io/cookieboty/autix-{api,web}:latest`）。

```bash
cp .env.example .env   # 填好 JWT_SECRET / POSTGRES_PASSWORD / SUPER_ADMIN_*
docker compose up -d
```

启动顺序：`postgres` → `api` → `web`，全部带 healthcheck 自动等待。

旧 split DB 切流到单库时，必须只在一次性迁移窗口设置：

```bash
RUN_FLAT_MIGRATION=true
FLAT_MIGRATION_TRUNCATE_TARGET=true
LEGACY_USER_DATABASE_URL=postgresql://...
LEGACY_CHAT_DATABASE_URL=postgresql://...
```

`api` 容器启动时会执行 `db:prepare-cutover`：`migrate deploy` → `db push` → `db:flat-migrate` → 生产 seed。未设置 `RUN_FLAT_MIGRATION=true` 时平迁脚本会跳过；设置为 true 但旧库 URL 缺失会直接失败，避免线上静默启动空库。

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

### 提示词模板（Template）

社区/个人提示词模板的发布、订阅、运行；运行结果记录到 `template_generations / generation_turns`。

### Artifacts

每个会话可关联一个 Artifact（Markdown / 代码 / 文档），自动按版本归档（`artifact_versions`），支持回滚和按 tag 过滤。

### 会员积分系统

- **三档会员**：Plus / Pro / Ultra，月/季/年 + 连续订阅
- **数据库驱动计费**：等级、价格、积分、折扣全部可在 `/admin` 管理后台配置
- **首单折扣** + **积分加油包**（独立购买）
- **按任务类型扣减积分**（`task_point_costs` 配置，`task_events` 记录）
- **邀请系统**：每人固定 aff 码，被邀请方首次注册成功后邀请人获 100 积分
- **完整订单流程**：下单 → 支付 → 履约

### 用户权限系统

- **多系统架构**：System → Role → Menu → Permission
- **注册审批**：用户注册 → 管理员审批
- **本地鉴权/RBAC**：API 内部直接使用统一 Prisma Client 查询用户、角色、菜单与权限

### 桌面端

- 复用 web 的全部业务（共享 `domain` / `sdk` / `platform` / `shared-ui` / `shared-store`）
- 主进程能力：托盘、全局快捷键、Deep Link（`autix://`）、单实例锁、自动更新（GHCR Releases）、原生通知
- 跨平台打包：`pnpm --filter @autix/desktop dist:mac` / `dist:win` / `dist:linux`

## 常用命令

```bash
# 开发
pnpm run dev              # 启动 Web 前后端
pnpm run dev:web          # 启动 Web + API
pnpm run dev:api          # 仅 API 服务
pnpm run dev:desktop      # 仅桌面端

# 构建 & 检查
pnpm run build            # 构建所有包
pnpm run typecheck        # TypeScript 类型检查
pnpm run clean:ports      # 终止占用 3100/4100/5173 的进程

# 数据库
pnpm --filter @autix/api run db:studio    # 统一 DB GUI

# 种子
pnpm --filter @autix/api run db:flat-migrate
pnpm --filter @autix/api run db:seed
pnpm --filter @autix/api run seed:membership
pnpm --filter @autix/api run seed:templates
pnpm --filter @autix/api run seed:resources
```

## 数据库

单一 PostgreSQL 数据库：`autix`。`packages/database` 是唯一 Prisma Schema / Client 来源。

- 会话与产物：`conversations` / `messages` / `artifacts` / `artifact_versions`
- 知识库：`documents` / `document_chunks`（pgvector）
- 模型与任务：`model_configs` / `task_events`
- 提示词模板：`prompt_templates` / `template_generations` / `generation_turns`
- 会员积分：`membership_levels` / `membership_plans` / `user_memberships` / `points_packages` / `user_points` / `points_records`
- 订单与邀请：`orders` / `invite_codes` / `invite_records` / `task_point_costs`
- Amux 凭据代理：`amux_credentials`
- 用户与权限：`users` / `roles` / `user_roles` / `menus` / `permissions` / `systems` / `system_registrations` / `user_sessions` / `oauth_clients`

## License

MIT
