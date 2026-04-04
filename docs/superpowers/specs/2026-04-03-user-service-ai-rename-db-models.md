# 用户系统 & AI 服务重命名 & 共享数据库模型 — 架构设计规格

## 1. 项目概述

**目标：** 在现有 Bun monorepo 基础上完成三项协同演进：
1. 将 `services/api`（AI/LLM 服务）重命名为 `services/ai`
2. 新增独立用户系统 `services/user`（认证、授权、用户管理）
3. 在 `packages/` 下新建共享数据库模型包 `@repo/db`，供所有后端服务使用

**技术栈：** Bun 1.3.11 + NestJS ^11 + Prisma ORM + PostgreSQL + Turborepo + Docker Compose

**执行顺序：** db 包 → ai 服务重命名 → user 服务 → compose 更新（严格按序）

---

## 2. 变更范围总览

```
/Users/botycookie/test/llm/
├── packages/
│   ├── contracts/          # 已有，不变
│   └── db/                 # 【新建】共享数据库模型包 @repo/db
├── services/
│   ├── api/  →  ai/        # 【重命名】@repo/api → @repo/ai，端口不变 3001
│   └── user/               # 【新建】@repo/user 用户服务，端口 3002
├── infra/compose/
│   ├── compose.yaml        # 【修改】添加 user 服务、postgres，更新 api→ai 路径
│   ├── compose.dev.yaml    # 【修改】同步 dev 覆盖
│   ├── Dockerfile.ai       # 【新建】原 Dockerfile.api 更名
│   └── Dockerfile.user     # 【新建】user 服务镜像
├── package.json            # 【修改】dev:api → dev:ai，新增 dev:user
├── tsconfig.base.json      # 【修改】添加 @repo/db 路径别名
└── clients/web/
    └── next.config.ts      # 【修改】添加 /user/:path* rewrite → 3002
```

---

## 3. 步骤 1：packages/db — 共享数据库模型包

### 设计原则
- 纯 Prisma 模型 + 生成客户端，不含业务逻辑
- source-first 导出（与 contracts 一致），无需独立 build 步骤供类型消费
- 同时导出 `PrismaClient` 实例工厂和所有 Prisma 生成类型
- 任意 NestJS 服务只需 `"@repo/db": "workspace:*"` 即可使用

### 目录结构
```
packages/db/
├── package.json          # name: @repo/db
├── tsconfig.json         # extends base, commonjs（兼容 NestJS）
├── prisma/
│   └── schema.prisma     # 数据模型定义（User、Session 等基础模型）
└── src/
    ├── index.ts          # 统一导出入口
    ├── client.ts         # PrismaClient 单例
    └── types.ts          # 重导出 Prisma 生成类型
```

### package.json
- `name: "@repo/db"`
- `exports: "./src/index.ts"`（source-first）
- `dependencies: { "@prisma/client": "^6.x", "prisma": "^6.x" }`
- `scripts: { "db:generate": "prisma generate", "db:migrate": "prisma migrate dev", "db:push": "prisma db push" }`
- `prisma.schema: "prisma/schema.prisma"`

### prisma/schema.prisma — 基础模型
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

model User {
  id          String    @id @default(cuid())
  email       String    @unique
  username    String    @unique
  passwordHash String
  displayName String?
  avatar      String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  sessions    Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### src/client.ts — PrismaClient 单例
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### src/index.ts — 统一导出
```typescript
export { prisma } from './client';
export type { User, Session, Prisma } from '@prisma/client';
```

### tsconfig.base.json 追加路径
```json
"@repo/db": ["./packages/db/src/index.ts"],
"@repo/db/*": ["./packages/db/src/*"]
```

---

## 4. 步骤 2：services/api → services/ai 重命名

### 变更点清单
| 文件 | 变更内容 |
|------|---------|
| `services/api/` 目录 | 整体移动/重命名为 `services/ai/` |
| `services/ai/package.json` | `"name": "@repo/api"` → `"name": "@repo/ai"` |
| `services/ai/src/main.ts` | 日志输出改为 `AI service running on :3001` |
| `services/ai/src/app.service.ts` | `Hello from AI` |
| `services/ai/src/app.controller.ts` | `Hello from AI service, APP_NAME=...` |
| `services/ai/src/app.controller.spec.ts` | 断言字符串同步更新 |
| 根 `package.json` | `dev:api` → `dev:ai`，filter `@repo/api` → `@repo/ai` |
| `infra/compose/compose.yaml` | `api` service → `ai`，Dockerfile.api → Dockerfile.ai，context 路径 |
| `infra/compose/compose.dev.yaml` | 同步 service name 和 volumes 路径 |
| `infra/compose/Dockerfile.api` | 重命名为 `Dockerfile.ai` |
| `clients/web/next.config.ts` | rewrites 目标主机名不变（`localhost:3001`） |

### 不变的内容
- 端口 3001 保持不变
- LangChain / LLM 业务逻辑代码不变
- `@repo/contracts` 依赖不变
- `tsconfig.json` extends 路径深度不变（`../../tsconfig.base.json`）
- `.env` 文件位置和内容不变

---

## 5. 步骤 3：services/user — 新建用户系统

### 服务职责
- 用户注册 / 登录 / 登出
- JWT 会话管理
- 用户信息 CRUD
- 密码哈希（bcrypt）
- 健康检查端点

### 端口分配
- `services/ai`：3001（保持不变）
- `services/user`：3002（新增）

### 目录结构
```
services/user/
├── package.json          # name: @repo/user
├── tsconfig.json         # extends ../../tsconfig.base.json, module: commonjs
├── nest-cli.json
└── src/
    ├── main.ts           # 监听 3002
    ├── app.module.ts     # 导入 UserModule, AuthModule
    ├── user/
    │   ├── user.module.ts
    │   ├── user.controller.ts  # GET /users/:id, PUT /users/:id, DELETE /users/:id
    │   └── user.service.ts     # CRUD，依赖 @repo/db
    └── auth/
        ├── auth.module.ts
        ├── auth.controller.ts  # POST /auth/register, POST /auth/login, POST /auth/logout
        └── auth.service.ts     # 注册、登录验证、JWT 签发、bcrypt
```

### API 端点规格

#### Auth 端点
| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/auth/register` | `{ email, username, password }` | `{ id, email, username, token }` |
| `POST` | `/auth/login` | `{ email, password }` | `{ token, user: { id, email, username } }` |
| `POST` | `/auth/logout` | `Authorization: Bearer <token>` | `{ ok: true }` |
| `GET` | `/health` | — | `{ ok: true, service: "user" }` |

#### User 端点
| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/users/:id` | Bearer JWT | `User` 对象 |
| `PUT` | `/users/:id` | Bearer JWT | 更新后的 `User` |
| `DELETE` | `/users/:id` | Bearer JWT | `{ ok: true }` |

### package.json 关键依赖
```json
{
  "name": "@repo/user",
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@repo/contracts": "workspace:*",
    "@repo/db": "workspace:*",
    "bcryptjs": "^2.4.3",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@nestjs/cli": "^11.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 6. 步骤 4：infra/compose 更新

### compose.yaml 目标状态
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: llm
      POSTGRES_PASSWORD: llmpass
      POSTGRES_DB: llmdb
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U llm"]
      interval: 5s
      timeout: 5s
      retries: 10

  ai:
    build:
      context: ../..
      dockerfile: infra/compose/Dockerfile.ai
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://llm:llmpass@postgres:5432/llmdb
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  user:
    build:
      context: ../..
      dockerfile: infra/compose/Dockerfile.user
    ports:
      - "3002:3002"
    environment:
      DATABASE_URL: postgresql://llm:llmpass@postgres:5432/llmdb
      JWT_SECRET: change-me-in-production
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3002/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    build:
      context: ../..
      dockerfile: infra/compose/Dockerfile.web
    ports:
      - "3000:3000"
    depends_on:
      ai:
        condition: service_healthy
      user:
        condition: service_healthy
```

### Next.js rewrites 追加
```typescript
{ source: "/user/:path*", destination: "http://localhost:3002/:path*" }
```

---

## 7. packages/db 与服务集成方式

### NestJS 模块中使用 @repo/db

```typescript
// 在任意 NestJS service 中
import { prisma } from '@repo/db';

@Injectable()
export class UserService {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}
```

**不需要** 注册全局模块，直接导入 `prisma` 单例使用。

---

## 8. 环境变量规格

| 变量 | 服务 | 说明 |
|------|------|------|
| `DATABASE_URL` | ai, user | PostgreSQL 连接字符串 |
| `JWT_SECRET` | user | JWT 签名密钥（生产环境必须替换） |
| `OPENAI_API_KEY` | ai | LLM 调用密钥（已有） |
| `OPENAI_BASE_URL` | ai | 自定义 endpoint（已有） |

各服务通过自己的 `.env` 文件读取（开发）或 Docker env_file / environment（容器）。

---

## 9. 验收标准

1. `bun install` 在根目录成功，无依赖冲突
2. `turbo run typecheck` 全量通过（ai、user、contracts、db）
3. `curl http://localhost:3001/health` → `{ ok: true }`
4. `curl http://localhost:3002/health` → `{ ok: true, service: "user" }`
5. `POST /auth/register` 成功创建用户并返回 JWT token
6. `POST /auth/login` 使用正确凭据登录返回 token
7. `docker compose -f infra/compose/compose.yaml config` 无语法错误
8. `packages/db` 的 `prisma generate` 成功生成客户端

---

## 10. 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| ORM | Prisma ^6 | 类型安全、与 TS/NestJS 生态成熟、迁移文件管理完善 |
| 数据库 | PostgreSQL 16 | 生产级，Prisma 最佳支持 |
| JWT 库 | @nestjs/jwt | NestJS 官方支持，集成简单 |
| 密码哈希 | bcryptjs | 纯 JS 实现，Bun 兼容性最好 |
| db 包导出模式 | source-first（同 contracts） | 无需预编译，Bun/TS paths 直接解析 |
| 端口分配 | ai:3001, user:3002 | ai 保持原端口，user 顺延 |
