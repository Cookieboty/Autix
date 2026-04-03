# Bun Workspaces Monorepo — 从零搭建

## 1. 项目概述

**目标：** 在 `/Users/botycookie/test/llm` 从零搭建一个 Bun workspaces monorepo，包含 Web (Next) 和 API (Nest) 两个服务，通过 shared contracts 包实现代码共享。

**技术栈：** Bun 1.3.11 + Next.js (app router) + NestJS + Turborepo + Docker Compose

**执行顺序：** 底座 → contracts → web → api → 联通 → compose（严格按序）

---

## 2. 步骤 1：根目录底座

### 目录结构
```
/Users/botycookie/test/llm/
├── clients/
├── services/
├── packages/contracts/
├── infra/compose/
├── package.json
├── bunfig.toml
├── turbo.json
└── tsconfig.base.json
```

### package.json
- `name: "root"`
- `private: true`
- `workspaces: ["clients/*", "services/*", "packages/*"]`
- `packageManager: "bun@1.3.11"`
- scripts: `dev`, `dev:web`, `dev:api`, `build`, `typecheck`

### bunfig.toml
```toml
[install]
linker = "isolated"
```

### turbo.json
```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### tsconfig.base.json
paths: `@repo/contracts` → `packages/contracts/src/index.ts`

---

## 3. 步骤 2：packages/contracts

- `src/index.ts` 导出 `APP_NAME = "llm"`
- `package.json` name: `@repo/contracts`
- `tsconfig.json`

---

## 4. 步骤 3：clients/web (Next.js)

- 初始化 Next (app router)，name: `@repo/web`
- 依赖 `"@repo/contracts": "workspace:*"`
- `next.config.ts`: `transpilePackages: ["@repo/contracts"]`, `output: "standalone"`, `outputFileTracingRoot`
- `app/page.tsx`: 显示 `"Hello from ${APP_NAME}"`

---

## 5. 步骤 4：services/api (NestJS)

- 初始化 NestJS，name: `@repo/api`
- 依赖 `"@repo/contracts": "workspace:*"`
- 监听端口 3001
- `GET /health` → `{ ok: true }`
- `GET /hello` → `{ message: "Hello from API, shared APP_NAME=${APP_NAME}" }`

---

## 6. 步骤 5：Web 调用 API 联通

- Web 页面加按钮，点击后 `fetch("/api/hello")` 并展示返回的 `message`
- Next rewrites 配置：`/api/:path` → `http://localhost:3001/:path`
- 前端请求写成 `fetch("/api/hello")`

---

## 7. 步骤 6：Docker Compose

### infra/compose/compose.yaml
- `web`: 端口 3000
- `api`: 端口 3001，healthcheck 访问 `/health`
- `web` `depends_on` api，`condition: service_healthy`

### infra/compose/compose.dev.yaml
- 挂载源码，支持开发热更新

---

## 8. 验收标准

1. 根目录 `bun install` + `bun run dev` 可运行
2. 打开 http://localhost:3000 显示 "Hello from llm"
3. 点击按钮展示 API 返回的 message
4. 每步完成后输出修改/新增文件列表
