# Bun Workspaces Monorepo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 Bun workspaces monorepo，包含 @repo/contracts、@repo/web (Next)、@repo/api (Nest)、Web→API 联通、Docker Compose 完整链路。

**Architecture:** Bun workspaces 单仓管理多包，turborepo 编排 build/dev，Next rewrites 做跨域代理，Docker Compose 统一编排。

**Tech Stack:** Bun 1.3.11 + Next.js (app router) + NestJS + Turborepo + Docker Compose

---

## Chunk 1: Step 1 — 根目录底座

**Files:**
- Create: `package.json`
- Create: `bunfig.toml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `clients/.gitkeep`
- Create: `services/.gitkeep`
- Create: `packages/contracts/.gitkeep`
- Create: `infra/compose/.gitkeep`

---

### Task 1: 创建根目录 package.json

- [ ] **Step 1: 创建 package.json**

Create: `package.json`
```json
{
  "name": "root",
  "private": true,
  "workspaces": [
    "clients/*",
    "services/*",
    "packages/*"
  ],
  "packageManager": "bun@1.3.11",
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=@repo/web",
    "dev:api": "turbo run dev --filter=@repo/api",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck"
  }
}
```

---

### Task 2: 创建 bunfig.toml

- [ ] **Step 1: 创建 bunfig.toml**

Create: `bunfig.toml`
```toml
[install]
linker = "isolated"
```

---

### Task 3: 创建 turbo.json

- [ ] **Step 1: 创建 turbo.json**

Create: `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

---

### Task 4: 创建 tsconfig.base.json

- [ ] **Step 1: 创建 tsconfig.base.json**

Create: `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "paths": {
      "@repo/contracts": ["./packages/contracts/src/index.ts"],
      "@repo/contracts/*": ["./packages/contracts/src/*"]
    }
  }
}
```

---

## Chunk 2: Step 2 — packages/contracts

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`

---

### Task 5: 创建 @repo/contracts

- [ ] **Step 1: 创建 packages/contracts/package.json**

Create: `packages/contracts/package.json`
```json
{
  "name": "@repo/contracts",
  "version": "0.0.0",
  "exports": "./src/index.ts",
  "types": "./src/index.ts"
}
```

- [ ] **Step 2: 创建 packages/contracts/tsconfig.json**

Create: `packages/contracts/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 packages/contracts/src/index.ts**

Create: `packages/contracts/src/index.ts`
```typescript
export const APP_NAME = "llm";
```

---

## Chunk 3: Step 3 — clients/web (Next.js)

**Files:**
- Create: `clients/web/package.json`
- Create: `clients/web/tsconfig.json`
- Create: `clients/web/next.config.ts`
- Create: `clients/web/app/layout.tsx`
- Create: `clients/web/app/page.tsx`
- Create: `clients/web/app/globals.css`
- Create: `clients/web/.gitignore`（Next 自动生成）

---

### Task 6: 创建 @repo/web Next.js 项目

- [ ] **Step 1: 创建 clients/web/package.json**

Create: `clients/web/package.json`
```json
{
  "name": "@repo/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/contracts": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 创建 clients/web/tsconfig.json**

Create: `clients/web/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 clients/web/next.config.ts**

Create: `clients/web/next.config.ts`
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/contracts"],
  output: "standalone",
  outputFileTracingRoot: new URL(".", import.meta.url).pathname.slice(0, -1),
};

export default nextConfig;
```

- [ ] **Step 4: 创建 clients/web/app/layout.tsx**

Create: `clients/web/app/layout.tsx`
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM App",
  description: "Bun workspaces monorepo demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: 创建 clients/web/app/globals.css**

Create: `clients/web/app/globals.css`
```css
body {
  font-family: system-ui, sans-serif;
  padding: 2rem;
}
```

- [ ] **Step 6: 创建 clients/web/app/page.tsx**

Create: `clients/web/app/page.tsx`
```tsx
"use client";

import { APP_NAME } from "@repo/contracts";
import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState<string>("");

  const handleClick = async () => {
    try {
      const res = await fetch("/api/hello");
      const data = await res.json();
      setMessage(data.message);
    } catch {
      setMessage("Error fetching data");
    }
  };

  return (
    <main>
      <h1>Hello from {APP_NAME}</h1>
      <button onClick={handleClick}>Call API</button>
      {message && <p id="message">{message}</p>}
    </main>
  );
}
```

- [ ] **Step 7: 创建 clients/web/next-env.d.ts**

Create: `clients/web/next-env.d.ts`
```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

---

## Chunk 4: Step 4 — services/api (NestJS)

**Files:**
- Create: `services/api/package.json`
- Create: `services/api/tsconfig.json`
- Create: `services/api/nest-cli.json`
- Create: `services/api/src/main.ts`
- Create: `services/api/src/app.module.ts`
- Create: `services/api/src/app.controller.ts`
- Create: `services/api/src/app.service.ts`
- Create: `services/api/src/app.controller.spec.ts`

---

### Task 7: 创建 @repo/api NestJS 项目

- [ ] **Step 1: 创建 services/api/package.json**

Create: `services/api/package.json`
```json
{
  "name": "@repo/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "nest start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@repo/contracts": "workspace:*",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 创建 services/api/tsconfig.json**

Create: `services/api/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 services/api/nest-cli.json**

Create: `services/api/nest-cli.json`
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: 创建 services/api/src/main.ts**

Create: `services/api/src/main.ts`
```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
  console.log("API running on http://localhost:3001");
}
bootstrap();
```

- [ ] **Step 5: 创建 services/api/src/app.module.ts**

Create: `services/api/src/app.module.ts`
```typescript
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 6: 创建 services/api/src/app.service.ts**

Create: `services/api/src/app.service.ts`
```typescript
import { Injectable } from "@nestjs/common";
import { APP_NAME } from "@repo/contracts";

@Injectable()
export class AppService {
  getHello(): { message: string } {
    return { message: `Hello from API, shared APP_NAME=${APP_NAME}` };
  }

  getHealth(): { ok: boolean } {
    return { ok: true };
  }
}
```

- [ ] **Step 7: 创建 services/api/src/app.controller.ts**

Create: `services/api/src/app.controller.ts`
```typescript
import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }

  @Get("hello")
  getHello() {
    return this.appService.getHello();
  }
}
```

- [ ] **Step 8: 创建 services/api/src/app.controller.spec.ts**

Create: `services/api/src/app.controller.spec.ts`
```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it("should return health ok", () => {
    expect(controller.getHealth()).toEqual({ ok: true });
  });

  it("should return hello message with APP_NAME", () => {
    const result = controller.getHello();
    expect(result.message).toContain("Hello from API");
    expect(result.message).toContain("llm");
  });
});
```

---

## Chunk 5: Step 5 — Web→API 联通（Next Rewrites）

**Files:**
- Modify: `clients/web/next.config.ts`

---

### Task 8: 配置 Next.js rewrites 代理

- [ ] **Step 1: 更新 clients/web/next.config.ts 添加 rewrites**

Edit `clients/web/next.config.ts` — replace the entire content with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/contracts"],
  output: "standalone",
  outputFileTracingRoot: new URL(".", import.meta.url).pathname.slice(0, -1),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
```

---

## Chunk 6: Step 6 — Docker Compose

**Files:**
- Create: `infra/compose/compose.yaml`
- Create: `infra/compose/compose.dev.yaml`
- Create: `infra/compose/Dockerfile.web`
- Create: `infra/compose/Dockerfile.api`

---

### Task 9: 创建 Docker Compose 配置

- [ ] **Step 1: 创建 infra/compose/Dockerfile.web**

Create: `infra/compose/Dockerfile.web`
```dockerfile
FROM oven/bun:1-alpine AS base

WORKDIR /app
COPY package.json ./
COPY bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./
COPY --from=base /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: 创建 infra/compose/Dockerfile.api**

Create: `infra/compose/Dockerfile.api`
```dockerfile
FROM oven/bun:1-alpine AS base

WORKDIR /app
COPY package.json ./
COPY bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/dist ./dist
EXPOSE 3001
CMD ["bun", "run", "dist/main.js"]
```

- [ ] **Step 3: 创建 infra/compose/compose.yaml**

Create: `infra/compose/compose.yaml`
```yaml
services:
  api:
    build:
      context: ../..
      dockerfile: infra/compose/Dockerfile.api
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  web:
    build:
      context: ../..
      dockerfile: infra/compose/Dockerfile.web
    ports:
      - "3000:3000"
    depends_on:
      api:
        condition: service_healthy
```

- [ ] **Step 4: 创建 infra/compose/compose.dev.yaml**

Create: `infra/compose/compose.dev.yaml`
```yaml
services:
  api:
    command: bun run dev
    volumes:
      - ../../services/api/src:/app/src

  web:
    command: bun run dev
    volumes:
      - ../../clients/web:/app
      - /app/node_modules
      - /app/.next
```

---

## Chunk 7: 根目录初始化与验证

**Files:**
- Create: `.gitignore`
- Modify: `package.json` (可能需要补充)

---

### Task 10: 根目录初始化

- [ ] **Step 1: 在根目录运行 bun install**

Run: `cd /Users/botycookie/test/llm && bun install`
Expected: 所有 workspace 依赖安装成功

- [ ] **Step 2: 创建 .gitignore**

Create: `.gitignore` in root
```
node_modules/
dist/
.next/
*.lockb
.turbo/
```

---

## Chunk 8: 验证清单

### Step 2 验证
- [ ] `bun run --filter @repo/contracts build` 成功

### Step 3 验证
- [ ] `bun run --filter @repo/web typecheck` 成功

### Step 4 验证
- [ ] `bun run --filter @repo/api typecheck` 成功
- [ ] `bun run --filter @repo/api dev` 后 `curl http://localhost:3001/health` 返回 `{ok:true}`
- [ ] `curl http://localhost:3001/hello` 返回包含 `Hello from API` 的 JSON

### Step 5 验证
- [ ] `bun run --filter @repo/web dev`
- [ ] 打开 http://localhost:3000 显示 "Hello from llm"
- [ ] 点击按钮，页面显示 "Hello from API, shared APP_NAME=llm"

### Step 6 验证
- [ ] `docker compose -f infra/compose/compose.yaml config` 无语法错误

---

## 每步完成后汇报模板

每步完成后，输出：
```
## Step X 完成

修改/新增文件：
- file1 (modified)
- file2 (created)
```
