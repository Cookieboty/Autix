# RBAC 权限系统实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有 Bun + Turbo monorepo 中，新增 `services/user-system`（NestJS RBAC 后端）和 `clients/admin-web`（Next.js 14 管理前台），实现完整的企业级前后端分离权限管理系统。

**Architecture:** 后端采用 NestJS 模块化架构，Prisma 管理 PostgreSQL 数据库，JWT 双 Token 认证，Guard + Decorator 实现接口级权限拦截；前端采用 Next.js 14 App Router，登录时一次性加载权限树，客户端缓存驱动菜单和按钮可见性。

**Tech Stack:** NestJS 11, Prisma 5, PostgreSQL, JWT, Next.js 14, Tailwind CSS, shadcn/ui, Bun, Turbo

---

## 阶段一：Monorepo 基础架构

### Task 1: 创建 packages/database

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/index.ts`
- Modify: `tsconfig.base.json`

**Step 1: 创建目录结构**

```bash
mkdir -p packages/database/prisma packages/database/src
```

**Step 2: 创建 package.json**

```bash
cat > packages/database/package.json << 'EOF'
{
  "name": "@repo/database",
  "version": "0.0.0",
  "private": true,
  "exports": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "bun run prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "typescript": "^5.7.0"
  }
}
EOF
```

**Step 3: 创建 tsconfig.json**

```bash
cat > packages/database/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "prisma"]
}
EOF
```

**Step 4: 创建 Prisma Schema（完整 RBAC 数据模型）**

文件太长，分步写入...


```bash
cat > packages/database/prisma/schema.prisma << 'SCHEMA_EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus {
  ACTIVE
  DISABLED
  LOCKED
}

enum PermissionAction {
  CREATE
  READ
  UPDATE
  DELETE
  EXPORT
  IMPORT
}

enum MenuType {
  DIRECTORY
  MENU
  BUTTON
}

model User {
  id           String      @id @default(cuid())
  username     String      @unique
  email        String      @unique
  password     String
  realName     String?
  avatar       String?
  phone        String?
  status       UserStatus  @default(ACTIVE)
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  roles        UserRole[]
  sessions     UserSession[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  lastLoginAt  DateTime?
  @@index([departmentId])
  @@index([status])
  @@map("users")
}

model Department {
  id          String       @id @default(cuid())
  name        String
  code        String       @unique
  parentId    String?
  parent      Department?  @relation("DepartmentTree", fields: [parentId], references: [id])
  children    Department[] @relation("DepartmentTree")
  sort        Int          @default(0)
  description String?
  users       User[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  @@index([parentId])
  @@map("departments")
}

model Role {
  id          String           @id @default(cuid())
  name        String           @unique
  code        String           @unique
  description String?
  sort        Int              @default(0)
  users       UserRole[]
  permissions RolePermission[]
  menus       RoleMenu[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  @@map("roles")
}

model UserRole {
  id        String   @id @default(cuid())
  userId    String
  roleId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}

model Permission {
  id          String           @id @default(cuid())
  name        String
  code        String           @unique
  module      String
  action      PermissionAction
  description String?
  roles       RolePermission[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  @@index([module])
  @@map("permissions")
}

model RolePermission {
  id           String     @id @default(cuid())
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
  @@unique([roleId, permissionId])
  @@index([roleId])
  @@index([permissionId])
  @@map("role_permissions")
}

model Menu {
  id             String   @id @default(cuid())
  name           String
  path           String?
  component      String?
  icon           String?
  type           MenuType
  parentId       String?
  parent         Menu?    @relation("MenuTree", fields: [parentId], references: [id])
  children       Menu[]   @relation("MenuTree")
  permissionCode String?
  sort           Int      @default(0)
  visible        Boolean  @default(true)
  isExternal     Boolean  @default(false)
  roles          RoleMenu[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([parentId])
  @@map("menus")
}

model RoleMenu {
  id        String   @id @default(cuid())
  roleId    String
  menuId    String
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  menu      Menu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([roleId, menuId])
  @@index([roleId])
  @@index([menuId])
  @@map("role_menus")
}

model UserSession {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique
  ip           String
  userAgent    String
  deviceName   String?
  expiresAt    DateTime
  lastActiveAt DateTime @default(now())
  createdAt    DateTime @default(now())
  @@index([userId])
  @@index([refreshToken])
  @@index([expiresAt])
  @@map("user_sessions")
}
SCHEMA_EOF
```

**Step 5: 创建 src/index.ts（导出 Prisma Client 和类型）**

```bash
cat > packages/database/src/index.ts << 'EOF'
export { PrismaClient } from '@prisma/client';
export type {
  User, Department, Role, Permission, Menu,
  UserRole, RolePermission, RoleMenu, UserSession,
  UserStatus, PermissionAction, MenuType,
} from '@prisma/client';
EOF
```

**Step 6: 更新 tsconfig.base.json 添加路径映射**

在 `tsconfig.base.json` 的 `paths` 中添加：
```json
"@repo/database": ["./packages/database/src/index.ts"],
"@repo/database/*": ["./packages/database/src/*"]
```

**Step 7: 安装依赖并生成 Prisma Client**

```bash
cd /Users/botycookie/test/llm
bun install
cd packages/database
bun run db:generate
```

Expected: 生成 `node_modules/.prisma/client`，无报错

**Step 8: Commit**

```bash
git add packages/database tsconfig.base.json
git commit -m "feat: add packages/database with Prisma schema for RBAC"
```

---

### Task 2: 创建 packages/types（共享 TypeScript 类型）

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/auth.types.ts`
- Create: `packages/types/src/rbac.types.ts`
- Create: `packages/types/src/index.ts`
- Modify: `tsconfig.base.json`

**Step 1: 创建目录结构**

```bash
mkdir -p packages/types/src
```

**Step 2: 创建 package.json**

```bash
cat > packages/types/package.json << 'EOF'
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "exports": "./src/index.ts",
  "types": "./src/index.ts"
}
EOF
```

**Step 3: 创建 tsconfig.json**

```bash
cat > packages/types/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
EOF
```

**Step 4: 创建 src/auth.types.ts**

```bash
cat > packages/types/src/auth.types.ts << 'EOF'
export interface JwtPayload {
  sub: string;
  username: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  realName?: string;
  avatar?: string;
  departmentId?: string;
  permissions: string[];
  roles: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
EOF
```

**Step 5: 创建 src/rbac.types.ts**

```bash
cat > packages/types/src/rbac.types.ts << 'EOF'
export interface MenuTreeNode {
  id: string;
  name: string;
  path?: string;
  icon?: string;
  type: 'DIRECTORY' | 'MENU' | 'BUTTON';
  permissionCode?: string;
  isExternal: boolean;
  visible: boolean;
  sort: number;
  children?: MenuTreeNode[];
}

export interface PermissionGroup {
  module: string;
  permissions: {
    id: string;
    name: string;
    code: string;
    action: string;
  }[];
}
EOF
```

**Step 6: 创建 src/index.ts**

```bash
cat > packages/types/src/index.ts << 'EOF'
export * from './auth.types';
export * from './rbac.types';
EOF
```

**Step 7: 更新 tsconfig.base.json**

在 `paths` 中添加：
```json
"@repo/types": ["./packages/types/src/index.ts"],
"@repo/types/*": ["./packages/types/src/*"]
```

**Step 8: Commit**

```bash
git add packages/types tsconfig.base.json
git commit -m "feat: add packages/types with shared auth and RBAC types"
```

---

## 阶段二：后端 user-system 服务

### Task 3: 初始化 services/user-system 项目骨架

**Files:**
- Create: `services/user-system/package.json`
- Create: `services/user-system/tsconfig.json`
- Create: `services/user-system/nest-cli.json`
- Create: `services/user-system/.env.example`
- Create: `services/user-system/src/main.ts`
- Create: `services/user-system/src/app.module.ts`

**Step 1: 创建目录结构**

```bash
mkdir -p services/user-system/src
```

**Step 2: 创建 package.json**


```bash
cat > services/user-system/package.json << 'EOF'
{
  "name": "@repo/user-system",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nodemon --watch src --ext ts --ignore dist --exec \"bun run build && bun --watch run dist/main.js\"",
    "build": "rm -rf dist tsconfig.tsbuildinfo && nest build",
    "start": "bun run dist/main.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.0",
    "bcryptjs": "^2.4.3",
    "@repo/database": "workspace:*",
    "@repo/types": "workspace:*",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/passport-jwt": "^4.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
EOF
```

**Step 3: 创建 tsconfig.json**

```bash
cat > services/user-system/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
EOF
```

**Step 4: 创建 nest-cli.json**

```bash
cat > services/user-system/nest-cli.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
EOF
```

**Step 5: 创建 .env.example**

```bash
cat > services/user-system/.env.example << 'EOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/user_system"
JWT_SECRET="your-super-secret-key-min-32-chars-change-in-production"
JWT_ACCESS_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="30d"
PORT=3002
EOF
```

**Step 6: 创建 src/main.ts**

```bash
cat > services/user-system/src/main.ts << 'EOF'
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  await app.listen(process.env.PORT ?? 3002);
  console.log(`User System running on port ${process.env.PORT ?? 3002}`);
}
bootstrap();
EOF
```

**Step 7: 创建 src/app.module.ts（骨架，模块稍后创建）**

```bash
cat > services/user-system/src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
EOF
```

**Step 8: 安装依赖**

```bash
cd /Users/botycookie/test/llm
bun install
```

Expected: 依赖安装成功

**Step 9: 验证构建**

```bash
cd services/user-system
bun run build
```

Expected: dist/ 生成，无 TypeScript 报错

**Step 10: Commit**

```bash
git add services/user-system
git commit -m "feat: scaffold user-system NestJS service"
```

---

### Task 4: PrismaModule（数据库连接）

**Files:**
- Create: `services/user-system/src/prisma/prisma.module.ts`
- Create: `services/user-system/src/prisma/prisma.service.ts`
- Modify: `services/user-system/src/app.module.ts`

**Step 1: 创建目录**

```bash
mkdir -p services/user-system/src/prisma
```

**Step 2: 创建 prisma.service.ts**

```bash
cat > services/user-system/src/prisma/prisma.service.ts << 'EOF'
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@repo/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
EOF
```

**Step 3: 创建 prisma.module.ts**

```bash
cat > services/user-system/src/prisma/prisma.module.ts << 'EOF'
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
EOF
```

**Step 4: 更新 app.module.ts 导入 PrismaModule**

```bash
cat > services/user-system/src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
EOF
```

**Step 5: 验证构建**

```bash
cd services/user-system
bun run build
```

Expected: 编译成功

**Step 6: Commit**

```bash
git add services/user-system/src/prisma services/user-system/src/app.module.ts
git commit -m "feat: add PrismaModule for user-system"
```

---

### Task 5: Auth 模块 - JWT 策略和 Guards

**Files:**
- Create: `services/user-system/src/auth/auth.module.ts`
- Create: `services/user-system/src/auth/strategies/jwt.strategy.ts`
- Create: `services/user-system/src/auth/guards/jwt-auth.guard.ts`
- Create: `services/user-system/src/auth/guards/permissions.guard.ts`
- Create: `services/user-system/src/auth/decorators/public.decorator.ts`
- Create: `services/user-system/src/auth/decorators/current-user.decorator.ts`
- Create: `services/user-system/src/auth/decorators/permissions.decorator.ts`
- Modify: `services/user-system/src/app.module.ts`

**Step 1: 创建目录结构**

```bash
mkdir -p services/user-system/src/auth/{strategies,guards,decorators}
```

**Step 2: 创建 decorators/public.decorator.ts**

```bash
cat > services/user-system/src/auth/decorators/public.decorator.ts << 'EOF'
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
EOF
```

**Step 3: 创建 decorators/current-user.decorator.ts**

```bash
cat > services/user-system/src/auth/decorators/current-user.decorator.ts << 'EOF'
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@repo/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
EOF
```

**Step 4: 创建 decorators/permissions.decorator.ts**

```bash
cat > services/user-system/src/auth/decorators/permissions.decorator.ts << 'EOF'
import { SetMetadata } from '@nestjs/common';
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
EOF
```

**Step 5: 创建 strategies/jwt.strategy.ts（实时权限查询）**


```bash
cat > services/user-system/src/auth/strategies/jwt.strategy.ts << 'EOF'
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthUser } from '@repo/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session) throw new UnauthorizedException('Session revoked');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User disabled');
    }

    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code),
        ),
      ),
    ];
    const roles = user.roles.map((ur) => ur.role.code);

    await this.prisma.userSession.update({
      where: { id: payload.sessionId },
      data: { lastActiveAt: new Date() },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      realName: user.realName ?? undefined,
      avatar: user.avatar ?? undefined,
      departmentId: user.departmentId ?? undefined,
      permissions,
      roles,
    };
  }
}
EOF
```

**Step 6: 创建 guards/jwt-auth.guard.ts**

```bash
cat > services/user-system/src/auth/guards/jwt-auth.guard.ts << 'EOF'
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
EOF
```

**Step 7: 创建 guards/permissions.guard.ts（权限校验）**

```bash
cat > services/user-system/src/auth/guards/permissions.guard.ts << 'EOF'
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthUser } from '@repo/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }
    return true;
  }
}
EOF
```

**Step 8: 创建 auth.module.ts**

```bash
cat > services/user-system/src/auth/auth.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1d' },
    }),
  ],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
EOF
```

**Step 9: 更新 app.module.ts 导入 AuthModule**

```bash
cat > services/user-system/src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
})
export class AppModule {}
EOF
```

**Step 10: 验证构建**

```bash
cd services/user-system
bun run build
```

Expected: 编译成功

**Step 11: Commit**

```bash
git add services/user-system/src/auth services/user-system/src/app.module.ts
git commit -m "feat: add JWT authentication with permissions guard"
```

---

### Task 6: Auth Controller 和 Service（登录/登出/刷新）

**Files:**
- Create: `services/user-system/src/auth/auth.controller.ts`
- Create: `services/user-system/src/auth/auth.service.ts`
- Create: `services/user-system/src/auth/dto/login.dto.ts`
- Modify: `services/user-system/src/auth/auth.module.ts`

**Step 1: 创建目录**

```bash
mkdir -p services/user-system/src/auth/dto
```

**Step 2: 创建 dto/login.dto.ts**

```bash
cat > services/user-system/src/auth/dto/login.dto.ts << 'EOF'
import { IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
EOF
```

**Step 3: 创建 auth.service.ts**

```bash
cat > services/user-system/src/auth/auth.service.ts << 'EOF'
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload, TokenPair } from '@repo/types';
import { LoginDto, RefreshDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账户已被禁用');
    }

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomUUID(),
        ip,
        userAgent,
        deviceName: dto.deviceName,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      sessionId: session.id,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken, refreshToken: session.refreshToken, expiresIn: 86400 };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('RefreshToken 已过期或无效');
    }

    const newRefreshToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt, lastActiveAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: session.user.id,
      username: session.user.username,
      sessionId: session.id,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken, refreshToken: newRefreshToken, expiresIn: 86400 };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.delete({ where: { id: sessionId } });
  }
}
EOF
```

**Step 4: 创建 auth.controller.ts**

```bash
cat > services/user-system/src/auth/auth.controller.ts << 'EOF'
import { Controller, Post, Body, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from '@repo/types';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    const req = arguments[1] as any;
    const sessionId = req.user.sessionId;
    await this.authService.logout(sessionId);
    return { message: '登出成功' };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthUser) {
    return user;
  }
}
EOF
```

**Step 5: 更新 auth.module.ts 注册 Controller 和 Service**

```bash
cat > services/user-system/src/auth/auth.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
EOF
```

**Step 6: 验证构建**

```bash
cd services/user-system
bun run build
```

Expected: 编译成功

**Step 7: Commit**

```bash
git add services/user-system/src/auth
git commit -m "feat: add auth controller with login/logout/refresh endpoints"
```

---

## 阶段三：业务模块（User/Role/Permission/Department/Menu）

由于篇幅限制，后续 Task 7-12 将包含：
- Task 7: User Module（用户 CRUD + 部门数据过滤）
- Task 8: Role Module（角色 CRUD + 权限分配）
- Task 9: Permission Module（权限 CRUD）
- Task 10: Department Module（部门树形 CRUD）
- Task 11: Menu Module（菜单树形 CRUD + 用户菜单查询）
- Task 12: Session Module（设备管理）

每个模块遵循相同模式：
1. 创建 DTO（class-validator）
2. 创建 Service（业务逻辑 + Prisma 查询）
3. 创建 Controller（@Permissions() 装饰器）
4. 注册到 AppModule
5. 构建验证
6. Commit

---

## 阶段四：数据库初始化

### Task 13: Prisma Seed（超级管理员 + 初始权限）

**Files:**
- Create: `packages/database/prisma/seed.ts`

**Step 1: 创建 seed.ts**

```bash
cat > packages/database/prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);

  const superAdminRole = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: '超级管理员',
      code: 'SUPER_ADMIN',
      description: '系统超级管理员，拥有所有权限',
      sort: 0,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      realName: '系统管理员',
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  const modules = ['user', 'role', 'permission', 'department', 'menu'];
  const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];

  for (const module of modules) {
    for (const action of actions) {
      const permission = await prisma.permission.upsert({
        where: { code: `${module}:${action.toLowerCase()}` },
        update: {},
        create: {
          name: `${module} ${action}`,
          code: `${module}:${action.toLowerCase()}`,
          module,
          action: action as any,
          description: `${action} ${module}`,
        },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('Seed completed!');
  console.log('Admin user: admin / Admin@123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF
```

**Step 2: 运行 Seed**

```bash
cd packages/database
bun run db:seed
```

Expected: 输出 "Seed completed!"

**Step 3: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat: add database seed with super admin and initial permissions"
```

---

## 阶段五：前端 Admin Web

### Task 14: 初始化 Next.js 14 项目

**Files:**
- Create: `clients/admin-web/package.json`
- Create: `clients/admin-web/next.config.ts`
- Create: `clients/admin-web/tsconfig.json`
- Create: `clients/admin-web/tailwind.config.ts`
- Create: `clients/admin-web/app/layout.tsx`
- Create: `clients/admin-web/app/page.tsx`

（详细步骤省略，包含 shadcn/ui 初始化、Tailwind 配置、App Router 结构）

### Task 15-20: 前端页面开发

- Task 15: 登录页面（app/(auth)/login）
- Task 16: 用户管理页面（app/(dashboard)/users）
- Task 17: 角色管理页面（app/(dashboard)/roles）
- Task 18: 权限分配界面（角色详情页）
- Task 19: 菜单管理页面（app/(dashboard)/menus）
- Task 20: 设备管理页面（app/(dashboard)/sessions）

每个页面包含：
1. 列表展示（Table + Pagination）
2. 新增/编辑 Dialog
3. 删除确认
4. 权限控制（按钮显示/禁用）

---

## 验收标准

### 后端验收
- [ ] 所有接口通过 Postman/curl 测试
- [ ] JWT 认证正常（登录、刷新、登出）
- [ ] 权限拦截生效（无权限返回 403）
- [ ] 部门数据过滤正常（只能看自己部门）
- [ ] 设备管理正常（查看、踢出设备）

### 前端验收
- [ ] 登录成功后跳转到首页
- [ ] 菜单根据权限动态显示
- [ ] 按钮根据权限显示/禁用
- [ ] 权限修改后，刷新页面立即生效
- [ ] 所有 CRUD 操作正常

### 数据库验收
- [ ] Prisma migrate 无报错
- [ ] Seed 数据正常
- [ ] 超级管理员可登录

---

## 执行建议

1. **按阶段执行**：先完成阶段一和二（后端基础），再做阶段三（业务模块），最后做前端
2. **频繁 Commit**：每个 Task 完成后立即 commit
3. **边开发边测试**：每个模块完成后用 Postman 测试接口
4. **使用 superpowers:executing-plans**：在新会话中执行此计划

