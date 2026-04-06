# Autix

Autix 是一个基于 Bun Workspaces + Turborepo 构建的全栈 Monorepo 项目，包含 AI 对话服务、用户权限管理系统和管理后台。

## 项目结构

```
autix/
├── clients/
│   ├── web/          # Next.js 前端（AI 对话入口）
│   └── admin-web/    # Next.js 管理后台（RBAC 权限管理）
├── services/
│   ├── chat/         # NestJS AI 对话服务
│   └── user-system/  # NestJS 用户权限系统（JWT 鉴权 + RBAC）
├── packages/
│   ├── database/     # Prisma 数据库 Schema 与 Seed
│   ├── types/        # 共享 TypeScript 类型定义
│   └── contracts/    # 共享常量
├── infra/
│   └── compose/      # Docker Compose 配置
└── turbo.json
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理 | Bun + Workspaces |
| 构建编排 | Turborepo |
| 前端 | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| 后端 | NestJS + Passport JWT |
| 数据库 | PostgreSQL + Prisma ORM |
| 容器化 | Docker Compose |

## 快速开始

### 前置要求

- [Bun](https://bun.sh) >= 1.3.11
- [Docker](https://www.docker.com) (用于数据库)

### 安装依赖

```bash
bun install
```

### 启动数据库

```bash
cd infra/compose
docker compose -f compose.dev.yaml up -d
```

### 初始化数据库

```bash
cd packages/database
bunx prisma migrate dev
bun run prisma/seed.ts
```

### 启动开发服务

```bash
# 启动所有服务
bun run dev

# 单独启动
bun run dev:web     # AI 对话前端 http://localhost:3000
bun run dev:chat    # AI 对话服务 http://localhost:3001
```

管理后台单独启动：

```bash
cd clients/admin-web
bun run dev         # http://localhost:3001
```

用户系统单独启动：

```bash
cd services/user-system
bun run dev
```

## 功能模块

### 管理后台（admin-web）

- 用户管理：增删改查、重置密码、状态管理
- 角色管理：角色 CRUD、关联菜单与权限
- 权限中心：系统/菜单/权限三级树形结构管理
- 部门管理：部门 CRUD
- 个人中心：个人信息查看

### 用户系统（user-system）

- JWT 登录鉴权
- 多系统切换
- 基于角色的访问控制（RBAC）
- 权限守卫（PermissionsGuard）

### AI 对话服务（chat）

- LangChain 集成
- 需求分析链（Requirement Chain）
- 摘要生成链（Summary Chain）

## 构建

```bash
bun run build
```

## 类型检查

```bash
bun run typecheck
```

## License

MIT
