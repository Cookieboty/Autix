# Amux Studio

**Think it. Build it. Ship it.**

PRD · 代码 · 设计 · 原型，AI 一站生成。从一句话需求到可交付产品的 AI 产品工作室。

## 项目概览

| 模块 | 描述 | 端口 |
|------|------|------|
| `clients/chat-web` | Next.js 前端（首页 + AI 工作台 + 会员中心 + 管理后台） | 3002 |
| `clients/admin-web` | Next.js 管理后台（用户/角色/权限） | 3001 |
| `services/chat` | NestJS AI 服务（多 Agent + RAG + 会员积分 + SSE） | 4001 |
| `services/user-system` | NestJS 用户/认证/RBAC 服务（gRPC） | 4002 |
| `packages/database` | Prisma Schema + 迁移 + 种子数据（用户系统 DB） | — |
| `packages/types` | 共享 TypeScript 类型 | — |
| `packages/contracts` | gRPC Proto 定义 + 共享 Schema | — |
| `packages/i18n` | 国际化配置（zh-CN / en / ja / fr / ru / vi / zh-TW） | — |

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 & 包管理 | Bun 1.3 + Workspaces |
| 构建编排 | Turborepo |
| 前端 | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + HeroUI |
| 后端 | NestJS 11 + Passport JWT |
| 数据库 | PostgreSQL 16 + Prisma ORM + pgvector |
| 服务间通信 | gRPC（user-system ↔ chat） |
| AI/LLM | LangChain + LangGraph + OpenAI 兼容 API |
| 实时通信 | SSE（Server-Sent Events） |
| 容器化 | Docker Compose |

## 目录结构

```
amux-studio/
├── clients/
│   ├── chat-web/                # Next.js 前端
│   │   ├── app/
│   │   │   ├── (app)/           # 登录后页面（chat / membership / ...）
│   │   │   ├── system/          # 管理后台（会员管理 / 用户审批 / ...）
│   │   │   ├── login/           # 登录
│   │   │   └── register/        # 注册（支持 ?aff= 邀请码）
│   │   ├── components/landing/  # 首页各 Section
│   │   └── messages/            # i18n 翻译文件
│   └── admin-web/               # 管理后台（用户/角色/权限）
├── services/
│   ├── chat/                    # AI 服务
│   │   ├── src/
│   │   │   ├── conversation/    # 会话 CRUD + SSE chat
│   │   │   ├── document/        # 文档上传 + 向量化
│   │   │   ├── llm/agents/      # 多 Agent 编排
│   │   │   ├── membership/      # 会员等级 + 计费方案
│   │   │   ├── points/          # 积分余额 + 流水
│   │   │   ├── order/           # 订单管理
│   │   │   ├── invite/          # 邀请系统（一人一码）
│   │   │   └── admin/           # 管理 API（CRUD + 赠送 + 审批）
│   │   ├── prisma/schema.prisma
│   │   └── scripts/
│   │       └── seed-membership.ts  # 会员积分种子数据
│   └── user-system/             # 用户/认证/RBAC 服务
│       └── src/
│           ├── auth/            # JWT 登录/注册/刷新
│           ├── registration/    # 注册审批
│           └── grpc/            # gRPC 服务（CheckAdmin / ListUsers / ApproveUser）
├── packages/
│   ├── database/                # 用户系统 Prisma Schema + 种子
│   ├── contracts/               # gRPC Proto + 共享常量
│   ├── types/                   # 共享 TypeScript 类型
│   └── i18n/                    # 国际化
├── infra/docker/                # init-db.sh（自动创建双数据库）
├── docker-compose.yml           # 生产部署（PostgreSQL + 全部服务）
└── package.json                 # Bun Workspaces 根配置
```

## 快速开始

### 前置要求

- [Bun](https://bun.sh) >= 1.3
- [Docker](https://www.docker.com) + Docker Compose
- PostgreSQL 16（Docker 自带，或自行安装）

### 1. 克隆 & 安装依赖

```bash
git clone <repo-url> amux-studio
cd amux-studio
bun install
```

### 2. 启动数据库

```bash
# 使用 Docker Compose 启动 PostgreSQL（含 pgvector 扩展）
# 自动创建 user_system 和 autix_chat 两个数据库
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

所有环境变量已收敛到根目录 `.env`，子包通过 `dotenv-cli` 自动注入（`dotenv -e ../../.env -- ...`），无需在子目录单独配置。

```bash
cp .env.example .env
```

**关键环境变量：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `CHAT_DATABASE_URL` | Chat 服务的 PostgreSQL 连接串 | `postgresql://autix:password@localhost:5432/autix_chat` |
| `USER_DATABASE_URL` | 用户系统的 PostgreSQL 连接串 | `postgresql://autix:password@localhost:5432/user_system` |
| `JWT_SECRET` | JWT 签名密钥（>= 32 字符） | `your-super-secret-key-here` |
| `INTERNAL_SECRET` | 服务间内部调用密钥 | 任意字符串 |
| `NEXT_PUBLIC_CHAT_API_URL` | 前端访问 chat 服务的地址 | `http://localhost:4001` |
| `NEXT_PUBLIC_USER_API_URL` | 前端访问 user 服务的地址 | `http://localhost:4002/api` |

### 4. 初始化数据库

```bash
# 用户系统 — 建表 + 种子数据（系统、角色、管理员账号）
cd packages/database
bunx prisma migrate deploy
bun run db:seed

# Chat 服务 — 建表 + 会员积分种子数据
cd ../../services/chat
bunx prisma migrate deploy
bunx prisma generate
bun run seed:membership
```

### 5. 启动全部服务

```bash
# 回到项目根目录
bun run dev
```

Turborepo 按依赖顺序启动：

| 服务 | 地址 | 说明 |
|------|------|------|
| user-system | http://localhost:4002 | 用户/认证 API + gRPC :50051 |
| chat | http://localhost:4001 | AI 服务 API |
| chat-web | http://localhost:3002 | 前端（首页 + 工作台 + 管理后台） |
| admin-web | http://localhost:3001 | 用户权限管理后台 |

### 超级管理员

超级管理员由 `user-system` 服务启动时根据环境变量自动创建（幂等，已存在则跳过）：

```bash
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=YourStrongPassword123   # >= 12 字符
```

> 若需重置密码，设置 `SUPER_ADMIN_RESET_PASSWORD=true` 后重启服务。

## Docker 一键部署

```bash
# 配置 .env（参考上方环境变量说明）
cp .env.example .env

# 启动全部服务
docker compose up -d
```

服务启动顺序：`postgres` → `user-system` → `chat` → `chat-web`，含健康检查自动等待。

## 核心功能

### AI 产品工作室

用户描述需求后，多 Agent 编排流水线自动生成结构化产品产物：

```
用户输入需求
  ↓
extractAgent    → 结构化 JSON（需求类型/核心功能/目标用户）
  ↓
clarifyAgent    → 判断是否需要澄清（不完整则追问）
  ↓
analysisAgent   → 功能分解 / 用户故事 / 验收标准
riskAgent       → 风险评估（技术/范围/业务）
  ↓
summaryAgent    → 综合报告（含知识库 RAG 引用）
  ↓
SSE 实时推送 Markdown 流
```

### 会员积分系统

- **三档会员**：Plus / Pro / Ultra，支持月/季/年 + 连续订阅
- **灵活计费**：所有价格、积分、折扣均数据库驱动，管理后台可配置
- **首次折扣**：新用户首次开通享特惠价
- **积分加油包**：独立购买，不受会员等级限制
- **AI 任务消耗**：按任务类型扣减积分
- **邀请系统**：每人固定 aff 码，好友注册并审批通过后双方获积分
- **订单管理**：完整的下单 → 支付 → 履约流程

### 管理后台（/system）

- 用户管理：查看全量用户 + 审批状态 + 一键审批
- 会员等级 & 计费方案：CRUD + 计费周期配置
- 积分加油包：CRUD
- 任务消耗配置：按任务类型设定积分消耗
- 订单管理 & 积分流水：全量查看
- 管理员赠送：赠送会员 / 赠送积分

### 用户权限系统

- **多系统架构**：System → Role → Menu → Permission
- **注册审批**：用户注册 → 管理员审批（支持从 chat 管理后台审批）
- **gRPC 通信**：chat 服务通过 gRPC 调用 user-system（CheckAdmin / ListUsers / ApproveUser）

## 常用命令

```bash
# 开发
bun run dev              # 启动所有服务
bun run dev:chat-web     # 仅启动前端
bun run dev:chat         # 仅启动 chat 服务

# 构建 & 检查
bun run build            # 构建所有包
bun run typecheck        # TypeScript 类型检查

# 数据库
cd packages/database && bunx prisma studio    # 用户系统 DB GUI
cd services/chat && bunx prisma studio        # Chat DB GUI

# 端口清理
bun run clean:ports      # 终止占用 3001/3002/4001/4002 的进程

# 种子数据（重新初始化）
cd packages/database && bun run db:seed       # 用户/角色/系统
cd services/chat && bun run seed:membership   # 会员/积分/任务消耗
```

## 数据库

两个独立 PostgreSQL 数据库：

**`user_system`**（packages/database）
- System / User / Role / UserRole / Menu / Permission
- SystemRegistration（注册审批，含 inviteCode）
- UserSession / OAuthClient

**`autix_chat`**（services/chat）
- Conversation / Message / Document / DocumentChunk（pgvector）
- MembershipLevel / MembershipPlan / UserMembership
- PointsPackage / UserPoints / PointsRecord
- Order / InviteCode / InviteRecord / TaskPointCost
- TaskEvent / ModelConfig / Artifact

## License

MIT
