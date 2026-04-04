# 用户系统 & AI 重命名 & 共享 DB 模型 — 实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 实施此计划。步骤使用 checkbox (`- [ ]`) 语法跟踪进度。

**Goal:** 在现有 Bun monorepo 完成：① 新建 `@repo/db` 共享数据库模型包，② 将 `services/api` 重命名为 `services/ai`，③ 新建 `services/user` 用户服务。

**Architecture:** packages/db（Prisma+PG）共享给所有后端服务，ai（3001）保持 LLM 职责，user（3002）负责认证与用户 CRUD。

**Tech Stack:** Bun 1.3.11 + NestJS ^11 + Prisma ^6 + PostgreSQL 16 + @nestjs/jwt + bcryptjs + Turborepo

---

## Chunk 1：packages/db — 共享数据库模型包

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/types.ts`
- Create: `packages/db/src/index.ts`
- Modify: `tsconfig.base.json`（添加 @repo/db 路径别名）

---

### Task 1：创建 packages/db/package.json

- [ ] **Step 1: 创建 packages/db/package.json**

Create: `packages/db/package.json`
```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "exports": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "prisma": {
    "schema": "prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

### Task 2：创建 packages/db/tsconfig.json

- [ ] **Step 1: 创建 packages/db/tsconfig.json**

Create: `packages/db/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "declaration": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

### Task 3：创建 Prisma schema

- [ ] **Step 1: 创建 packages/db/prisma/schema.prisma**

Create: `packages/db/prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  username     String    @unique
  passwordHash String
  displayName  String?
  avatar       String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions     Session[]
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

---

### Task 4：创建 packages/db/src 源文件

- [ ] **Step 1: 创建 packages/db/src/client.ts**

Create: `packages/db/src/client.ts`
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: 创建 packages/db/src/types.ts**

Create: `packages/db/src/types.ts`
```typescript
export type { User, Session, Prisma } from '@prisma/client';
```

- [ ] **Step 3: 创建 packages/db/src/index.ts**

Create: `packages/db/src/index.ts`
```typescript
export { prisma } from './client';
export type { User, Session, Prisma } from './types';
```

---

### Task 5：更新 tsconfig.base.json 路径别名

- [ ] **Step 1: 在 tsconfig.base.json 的 paths 中添加 @repo/db**

Edit `tsconfig.base.json` — 在 `"@repo/contracts/*"` 之后追加：
```json
"@repo/db": ["./packages/db/src/index.ts"],
"@repo/db/*": ["./packages/db/src/*"]
```

---

## Chunk 2：services/api → services/ai 重命名

**Files:**
- Rename directory: `services/api/` → `services/ai/`
- Modify: `services/ai/package.json`（name: @repo/ai）
- Modify: `services/ai/src/main.ts`（日志更新）
- Modify: `services/ai/src/app.service.ts`（Hello from AI）
- Modify: `services/ai/src/app.controller.spec.ts`（断言同步）
- Modify: 根 `package.json`（dev:api → dev:ai）
- Rename: `infra/compose/Dockerfile.api` → `Dockerfile.ai`
- Modify: `infra/compose/compose.yaml`

---

### Task 6：重命名服务目录与包名

- [ ] **Step 1: 移动目录 services/api → services/ai**

Run: `mv /Users/botycookie/test/llm/services/api /Users/botycookie/test/llm/services/ai`

- [ ] **Step 2: 更新 services/ai/package.json 中的 name**

Edit `services/ai/package.json`:
- `"name": "@repo/api"` → `"name": "@repo/ai"`

- [ ] **Step 3: 更新 services/ai/src/main.ts 日志**

Edit `services/ai/src/main.ts`:
- `"API running on"` → `"AI service running on"`

- [ ] **Step 4: 更新 services/ai/src/app.service.ts**

Edit `services/ai/src/app.service.ts`:
- `"Hello from API"` → `"Hello from AI"`

- [ ] **Step 5: 更新 services/ai/src/app.controller.spec.ts 断言**

Edit `services/ai/src/app.controller.spec.ts`:
- `"Hello from API"` → `"Hello from AI"`（所有出现处）

---

### Task 7：更新根 package.json 脚本

- [ ] **Step 1: 更新根 package.json**

Edit `package.json`:
- `"dev:api": "turbo run dev --filter=@repo/api"` → `"dev:ai": "turbo run dev --filter=@repo/ai"`

---

### Task 8：更新 infra/compose

- [ ] **Step 1: 重命名 Dockerfile.api → Dockerfile.ai**

Run: `mv /Users/botycookie/test/llm/infra/compose/Dockerfile.api /Users/botycookie/test/llm/infra/compose/Dockerfile.ai`

- [ ] **Step 2: 更新 compose.yaml — 将 api service 改为 ai，添加 postgres**

Edit `infra/compose/compose.yaml` 全量替换为：
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
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U llm"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 5s

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
      start_period: 10s

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
      start_period: 10s

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

volumes:
  postgres_data:
```

- [ ] **Step 3: 更新 compose.dev.yaml**

Edit `infra/compose/compose.dev.yaml` 全量替换为：
```yaml
services:
  ai:
    command: bun run dev
    volumes:
      - ../../services/ai/src:/app/src

  user:
    command: bun run dev
    volumes:
      - ../../services/user/src:/app/src

  web:
    command: bun run dev
    volumes:
      - ../../clients/web:/app
      - /app/node_modules
      - /app/.next
```

---

## Chunk 3：services/user — 新建用户系统

**Files:**
- Create: `services/user/package.json`
- Create: `services/user/tsconfig.json`
- Create: `services/user/nest-cli.json`
- Create: `services/user/src/main.ts`
- Create: `services/user/src/app.module.ts`
- Create: `services/user/src/auth/auth.module.ts`
- Create: `services/user/src/auth/auth.controller.ts`
- Create: `services/user/src/auth/auth.service.ts`
- Create: `services/user/src/user/user.module.ts`
- Create: `services/user/src/user/user.controller.ts`
- Create: `services/user/src/user/user.service.ts`
- Create: `infra/compose/Dockerfile.user`
- Modify: `clients/web/next.config.ts`（添加 /user/:path* rewrite）
- Modify: 根 `package.json`（新增 dev:user 脚本）

---

### Task 9：创建 services/user 基础配置文件

- [ ] **Step 1: 创建 services/user/package.json**

Create: `services/user/package.json`
```json
{
  "name": "@repo/user",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nodemon --watch src --ext ts --ignore dist --exec \"bun run build && bun --watch run dist/main.js\"",
    "build": "nest build",
    "start": "bun run dist/main.js",
    "typecheck": "tsc --noEmit"
  },
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
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 创建 services/user/tsconfig.json**

Create: `services/user/tsconfig.json`
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

- [ ] **Step 3: 创建 services/user/nest-cli.json**

Create: `services/user/nest-cli.json`
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

---

### Task 10：创建 services/user/src 入口文件

- [ ] **Step 1: 创建 services/user/src/main.ts**

Create: `services/user/src/main.ts`
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3002);
  console.log('User service running on http://localhost:3002');
}
bootstrap();
```

- [ ] **Step 2: 创建 services/user/src/app.module.ts**

Create: `services/user/src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [AuthModule, UserModule],
})
export class AppModule {}
```

---

### Task 11：创建 auth 模块

- [ ] **Step 1: 创建 services/user/src/auth/auth.module.ts**

Create: `services/user/src/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

- [ ] **Step 2: 创建 services/user/src/auth/auth.service.ts**

Create: `services/user/src/auth/auth.service.ts`
```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@repo/db';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(email: string, username: string, password: string) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { id: user.id, email: user.email, username: user.username, token };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      token,
      user: { id: user.id, email: user.email, username: user.username },
    };
  }

  async logout(token: string) {
    await prisma.session.deleteMany({ where: { token } });
    return { ok: true };
  }

  async validateToken(token: string) {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
  }
}
```

- [ ] **Step 3: 创建 services/user/src/auth/auth.controller.ts**

Create: `services/user/src/auth/auth.controller.ts`
```typescript
import { Controller, Post, Body, Headers, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  getHealth() {
    return { ok: true, service: 'user' };
  }

  @Post('auth/register')
  register(
    @Body() body: { email: string; username: string; password: string },
  ) {
    return this.authService.register(body.email, body.username, body.password);
  }

  @Post('auth/login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('auth/logout')
  logout(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '') ?? '';
    return this.authService.logout(token);
  }
}
```

---

### Task 12：创建 user 模块

- [ ] **Step 1: 创建 services/user/src/user/user.module.ts**

Create: `services/user/src/user/user.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

- [ ] **Step 2: 创建 services/user/src/user/user.service.ts**

Create: `services/user/src/user/user.service.ts`
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@repo/db';

@Injectable()
export class UserService {
  async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: { displayName?: string; avatar?: string }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
```

- [ ] **Step 3: 创建 services/user/src/user/user.controller.ts**

Create: `services/user/src/user/user.controller.ts`
```typescript
import { Controller, Get, Put, Delete, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { displayName?: string; avatar?: string },
  ) {
    return this.userService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
```

---

### Task 13：创建 Dockerfile.user

- [ ] **Step 1: 创建 infra/compose/Dockerfile.user**

Create: `infra/compose/Dockerfile.user`
```dockerfile
FROM oven/bun:1-alpine AS base

WORKDIR /app
COPY package.json ./
COPY bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build --filter=@repo/user

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/services/user/dist ./dist
COPY --from=base /app/node_modules ./node_modules
EXPOSE 3002
CMD ["bun", "run", "dist/main.js"]
```

---

### Task 14：更新前端 next.config.ts 和根脚本

- [ ] **Step 1: 更新 clients/web/next.config.ts 添加 /user/:path* rewrite**

Edit `clients/web/next.config.ts` — 在 rewrites 数组中追加：
```typescript
{
  source: "/user/:path*",
  destination: "http://localhost:3002/:path*",
}
```

- [ ] **Step 2: 更新根 package.json 添加 dev:user 脚本**

Edit `package.json` — 在 scripts 中添加：
```json
"dev:user": "turbo run dev --filter=@repo/user"
```

---

## Chunk 4：安装依赖与验证

### Task 15：运行安装和验证

- [ ] **Step 1: 在根目录运行 bun install**

Run: `cd /Users/botycookie/test/llm && bun install`
Expected: 所有 workspace 依赖安装成功，@repo/db、@repo/user 均被识别

- [ ] **Step 2: 生成 Prisma 客户端**

Run: `cd /Users/botycookie/test/llm/packages/db && bun run db:generate`
Expected: Prisma Client 生成成功

- [ ] **Step 3: 验证 Docker Compose 配置语法**

Run: `docker compose -f /Users/botycookie/test/llm/infra/compose/compose.yaml config`
Expected: 无语法错误，输出完整配置

---

## 验收清单

### packages/db
- [ ] `bun install` 成功，`@prisma/client` 已安装
- [ ] `prisma generate` 成功生成类型
- [ ] `@repo/db` 路径别名在 tsconfig.base.json 中配置正确

### services/ai（原 api）
- [ ] 目录重命名为 `services/ai/`
- [ ] package.json name 为 `@repo/ai`
- [ ] 根 package.json 有 `dev:ai` 脚本
- [ ] `curl http://localhost:3001/health` → `{ ok: true }`

### services/user
- [ ] 目录结构完整（auth、user 模块）
- [ ] `curl http://localhost:3002/health` → `{ ok: true, service: "user" }`
- [ ] `POST /auth/register` 正常创建用户
- [ ] `POST /auth/login` 正常返回 JWT token

### infra
- [ ] compose.yaml 含 postgres、ai、user、web 四个 service
- [ ] Dockerfile.ai 和 Dockerfile.user 均存在
- [ ] `docker compose config` 无错误

---

## 每步完成后汇报模板

每步完成后，输出：
```
## Chunk X 完成

修改/新增文件：
- file1 (modified)
- file2 (created)

下一步：Chunk Y — <描述>
```
