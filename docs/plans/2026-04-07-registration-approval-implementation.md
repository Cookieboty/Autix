# Registration & Approval System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add self-registration for chat-web users with PENDING status, admin approval in admin-web, and PENDING-state login support.

**Architecture:** New `SystemRegistration` table links users to systems with approval state. `UserStatus` gets a `PENDING` value. Registration logic lives in a new `registration` NestJS module. Frontend adds register/pending pages to chat-web and an approval tab to admin-web /users.

**Tech Stack:** Prisma (PostgreSQL), NestJS, Next.js 15 App Router, Tailwind CSS v4, Zustand, React Query, react-hook-form

**Design Doc:** `docs/plans/2026-04-07-registration-approval-design.md`

---

### Task 1: Prisma Schema — Add PENDING status and SystemRegistration table

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Update schema.prisma**

In `packages/database/prisma/schema.prisma`, make these three changes:

1. Change `UserStatus` enum (line 10-14):
```prisma
enum UserStatus {
  ACTIVE
  DISABLED
  LOCKED
  PENDING
}
```

2. Add `RegistrationStatus` enum after the `ClientStatus` enum (after line 38):
```prisma
enum RegistrationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

3. Add `SystemRegistration` model after the `OAuthAuthorizationCode` model (at end of file):
```prisma
model SystemRegistration {
  id            String             @id @default(cuid())
  userId        String
  systemId      String
  status        RegistrationStatus @default(PENDING)
  note          String?
  createdAt     DateTime           @default(now())
  processedAt   DateTime?
  processedById String?

  user          User    @relation("UserRegistrations", fields: [userId], references: [id], onDelete: Cascade)
  system        System  @relation(fields: [systemId], references: [id])
  processedBy   User?   @relation("ProcessedRegistrations", fields: [processedById], references: [id])

  @@unique([userId, systemId])
  @@map("system_registrations")
}
```

4. Add reverse relations to `User` model (after `accounts` field on line 70):
```prisma
  registrations     SystemRegistration[] @relation("UserRegistrations")
  processedRegs     SystemRegistration[] @relation("ProcessedRegistrations")
```

5. Add reverse relation to `System` model (after `clients` field on line 49):
```prisma
  registrations     SystemRegistration[]
```

**Step 2: Run migration**

```bash
cd /Users/botycookie/test/llm
npx prisma migrate dev --name add-registration-approval --schema=packages/database/prisma/schema.prisma
```

Expected: Migration created and applied, Prisma client regenerated.

**Step 3: Verify client generated**

```bash
ls packages/database/node_modules/.prisma/client/
```

Expected: Files present including `index.d.ts`.

**Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add PENDING user status and SystemRegistration table"
```

---

### Task 2: Seed — Add chat system, SYSTEM_ADMIN role, USER role

**Files:**
- Modify: `packages/database/prisma/seed.ts`

**Step 1: Add chat system seed data**

In `packages/database/prisma/seed.ts`, add after the `cmsSystem` upsert (after line 34), before the menus section:

```typescript
  const chatSystem = await prisma.system.upsert({
    where: { code: 'chat' },
    update: {},
    create: {
      name: 'Chat',
      code: 'chat',
      description: 'AI 智能对话系统',
      status: 'ACTIVE',
      sort: 3,
    },
  });
```

Then add chat system roles after the `cmsSystemEditor` upsert (after line 274):

```typescript
  // Chat 系统角色
  const chatSystemAdmin = await prisma.role.upsert({
    where: { systemId_code: { systemId: chatSystem.id, code: 'SYSTEM_ADMIN' } },
    update: {},
    create: {
      systemId: chatSystem.id,
      name: '系统管理员',
      code: 'SYSTEM_ADMIN',
      description: 'Chat 系统管理员，可审批注册申请',
      sort: 1,
    },
  });

  const chatSystemUser = await prisma.role.upsert({
    where: { systemId_code: { systemId: chatSystem.id, code: 'USER' } },
    update: {},
    create: {
      systemId: chatSystem.id,
      name: '普通用户',
      code: 'USER',
      description: 'Chat 系统普通用户，注册审批通过后自动分配',
      sort: 2,
    },
  });
```

Also update the summary log at the bottom to include the new resources.

**Step 2: Run seed**

```bash
cd /Users/botycookie/test/llm
npx prisma db seed --schema=packages/database/prisma/schema.prisma
```

Expected: Seed completes without errors, chat system and roles created.

**Step 3: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat(db): seed chat system with SYSTEM_ADMIN and USER roles"
```

---

### Task 3: user-system — RegisterDto and POST /auth/register endpoint

**Files:**
- Modify: `services/user-system/src/auth/dto/login.dto.ts`
- Modify: `services/user-system/src/auth/auth.service.ts`
- Modify: `services/user-system/src/auth/auth.controller.ts`

**Step 1: Add RegisterDto to login.dto.ts**

Add at end of `services/user-system/src/auth/dto/login.dto.ts`:

```typescript
import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  systemCode: string;
}
```

Note: Update the import at line 1 to include `IsEmail, MaxLength`:
```typescript
import { IsString, MinLength, IsOptional, IsEmail, MaxLength } from 'class-validator';
```

**Step 2: Add register() method to auth.service.ts**

Add import for `ConflictException` to the imports on line 1:
```typescript
import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
```

Add `RegisterDto` to the import on line 6:
```typescript
import { LoginDto, RefreshDto, RegisterDto } from './dto/login.dto';
```

Add the `register()` method after the `login()` method (after line 76):

```typescript
  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('用户名已存在');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email 已存在');
    }

    const system = await this.prisma.system.findUnique({
      where: { code: dto.systemCode },
    });
    if (!system) {
      throw new BadRequestException('系统不存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        status: 'PENDING',
      },
    });

    await this.prisma.systemRegistration.create({
      data: {
        userId: user.id,
        systemId: system.id,
        status: 'PENDING',
      },
    });

    return { message: '注册成功，等待管理员审批' };
  }
```

**Step 3: Modify login() in auth.service.ts to allow PENDING users**

Change line 32-34 from:
```typescript
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账户已被禁用');
    }
```

To:
```typescript
    if (user.status === 'DISABLED' || user.status === 'LOCKED') {
      throw new UnauthorizedException('账户已被禁用');
    }
```

**Step 4: Add POST /auth/register to auth.controller.ts**

Add `RegisterDto` to the import on line 3:
```typescript
import { LoginDto, RefreshDto, RegisterDto } from './dto/login.dto';
```

Add the register endpoint after the login method (after line 19):

```typescript
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
```

**Step 5: Verify the service compiles**

```bash
cd /Users/botycookie/test/llm/services/user-system
bun run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

**Step 6: Commit**

```bash
git add services/user-system/src/auth/
git commit -m "feat(user-system): add register endpoint with PENDING status support"
```

---

### Task 4: user-system — Registration module (list, approve, reject)

**Files:**
- Create: `services/user-system/src/registration/registration.module.ts`
- Create: `services/user-system/src/registration/registration.controller.ts`
- Create: `services/user-system/src/registration/registration.service.ts`
- Create: `services/user-system/src/registration/dto/process-registration.dto.ts`
- Modify: `services/user-system/src/app.module.ts`

**Step 1: Create ProcessRegistrationDto**

Create `services/user-system/src/registration/dto/process-registration.dto.ts`:

```typescript
import { IsOptional, IsString } from 'class-validator';

export class ProcessRegistrationDto {
  @IsOptional()
  @IsString()
  note?: string;
}
```

**Step 2: Create registration.service.ts**

Create `services/user-system/src/registration/registration.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '@repo/types';
import { ProcessRegistrationDto } from './dto/process-registration.dto';

@Injectable()
export class RegistrationService {
  constructor(private prisma: PrismaService) {}

  private async assertSystemAdminAccess(user: AuthUser, systemId: string): Promise<void> {
    if (user.isSuperAdmin) return;
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: { systemId, code: 'SYSTEM_ADMIN' },
      },
    });
    if (!userRole) {
      throw new ForbiddenException('无权操作此系统的注册申请');
    }
  }

  async findAll(user: AuthUser, systemId?: string, status?: string) {
    // Build the system filter based on user access
    let systemFilter: any;
    if (systemId) {
      await this.assertSystemAdminAccess(user, systemId);
      systemFilter = { systemId };
    } else if (!user.isSuperAdmin) {
      // Get all systems where user is SYSTEM_ADMIN
      const adminRoles = await this.prisma.userRole.findMany({
        where: {
          userId: user.id,
          role: { code: 'SYSTEM_ADMIN' },
        },
        include: { role: true },
      });
      const systemIds = adminRoles.map((ur) => ur.role.systemId);
      systemFilter = { systemId: { in: systemIds } };
    }

    const where: any = { ...systemFilter };
    if (status) where.status = status;

    return this.prisma.systemRegistration.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, email: true, realName: true, createdAt: true },
        },
        system: { select: { id: true, name: true, code: true } },
        processedBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, user: AuthUser, dto: ProcessRegistrationDto) {
    const registration = await this.prisma.systemRegistration.findUnique({
      where: { id },
      include: { system: true },
    });
    if (!registration) throw new NotFoundException('注册申请不存在');
    if (registration.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }

    await this.assertSystemAdminAccess(user, registration.systemId);

    // Find the default USER role for this system
    const userRole = await this.prisma.role.findFirst({
      where: { systemId: registration.systemId, code: 'USER' },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.systemRegistration.update({
        where: { id },
        data: {
          status: 'APPROVED',
          note: dto.note,
          processedAt: new Date(),
          processedById: user.id,
        },
      });

      await tx.user.update({
        where: { id: registration.userId },
        data: { status: 'ACTIVE' },
      });

      if (userRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: registration.userId, roleId: userRole.id } },
          update: {},
          create: { userId: registration.userId, roleId: userRole.id },
        });
      }
    });

    return { message: '审批通过' };
  }

  async reject(id: string, user: AuthUser, dto: ProcessRegistrationDto) {
    const registration = await this.prisma.systemRegistration.findUnique({
      where: { id },
    });
    if (!registration) throw new NotFoundException('注册申请不存在');
    if (registration.status !== 'PENDING') {
      throw new BadRequestException('该申请已处理');
    }

    await this.assertSystemAdminAccess(user, registration.systemId);

    await this.prisma.$transaction(async (tx) => {
      await tx.systemRegistration.update({
        where: { id },
        data: {
          status: 'REJECTED',
          note: dto.note,
          processedAt: new Date(),
          processedById: user.id,
        },
      });

      await tx.user.update({
        where: { id: registration.userId },
        data: { status: 'DISABLED' },
      });
    });

    return { message: '已拒绝' };
  }

  async getPendingCount(user: AuthUser): Promise<number> {
    if (user.isSuperAdmin) {
      return this.prisma.systemRegistration.count({ where: { status: 'PENDING' } });
    }
    const adminRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id, role: { code: 'SYSTEM_ADMIN' } },
      include: { role: true },
    });
    const systemIds = adminRoles.map((ur) => ur.role.systemId);
    return this.prisma.systemRegistration.count({
      where: { status: 'PENDING', systemId: { in: systemIds } },
    });
  }
}
```

**Step 3: Create registration.controller.ts**

Create `services/user-system/src/registration/registration.controller.ts`:

```typescript
import { Controller, Get, Put, Param, Body, Query } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { ProcessRegistrationDto } from './dto/process-registration.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@repo/types';

@Controller('registrations')
export class RegistrationController {
  constructor(private registrationService: RegistrationService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('systemId') systemId?: string,
    @Query('status') status?: string,
  ) {
    return this.registrationService.findAll(user, systemId, status);
  }

  @Get('pending-count')
  async getPendingCount(@CurrentUser() user: AuthUser) {
    const count = await this.registrationService.getPendingCount(user);
    return { count };
  }

  @Put(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ProcessRegistrationDto,
  ) {
    return this.registrationService.approve(id, user, dto);
  }

  @Put(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ProcessRegistrationDto,
  ) {
    return this.registrationService.reject(id, user, dto);
  }
}
```

**Step 4: Create registration.module.ts**

Create `services/user-system/src/registration/registration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}
```

**Step 5: Add RegistrationModule to app.module.ts**

In `services/user-system/src/app.module.ts`, add import:
```typescript
import { RegistrationModule } from './registration/registration.module';
```

Add `RegistrationModule` to the imports array in `@Module`.

**Step 6: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system
bun run build 2>&1 | tail -20
```

Expected: No TypeScript errors.

**Step 7: Commit**

```bash
git add services/user-system/src/registration/ services/user-system/src/app.module.ts
git commit -m "feat(user-system): add registration approval module with approve/reject endpoints"
```

---

### Task 5: chat-web — Register page (`/register`)

**Files:**
- Create: `clients/chat-web/app/register/page.tsx`
- Modify: `clients/chat-web/lib/api.ts` (add register function)

**Step 1: Add register API call to api.ts**

Read `clients/chat-web/lib/api.ts` first, then add a named export for the register function. The file has `userApi` as an axios instance. Add at the end:

```typescript
export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  systemCode: string;
}) => userApi.post('/auth/register', data);
```

**Step 2: Create register page**

Create `clients/chat-web/app/register/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { MessageSquare, Eye, EyeOff } from 'lucide-react';
import { registerUser } from '@/lib/api';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>();

  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        systemCode: 'chat',
      });
      router.push('/pending');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError(msg || '注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(30,27,75,0.8)',
    border: '1px solid rgba(99,102,241,0.3)',
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F0F23 0%, #1E1B4B 50%, #312E81 100%)' }}
      >
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-indigo-400/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.3) 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(67,56,202,0.4)', border: '1px solid rgba(99,102,241,0.5)' }}
            >
              <MessageSquare className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Autix AI</div>
              <div className="text-indigo-300 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-white leading-tight">
            加入 Autix AI
            <br />
            <span style={{ color: '#22C55E' }}>开启智能分析</span>
          </h2>
          <p className="text-indigo-200/70 text-sm leading-relaxed">
            注册后，管理员将在 1 个工作日内完成审批。审批通过后即可开始使用。
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-indigo-300/40 text-xs font-mono">
            &gt; 分析用户需求结构...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#1a1a2e' }}>
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">创建账号</h1>
            <p className="text-indigo-200/50 text-sm">填写信息后等待管理员审批</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">用户名</label>
              <input
                {...register('username', {
                  required: '请输入用户名',
                  minLength: { value: 3, message: '用户名至少 3 个字符' },
                  maxLength: { value: 20, message: '用户名最多 20 个字符' },
                })}
                placeholder="3-20 个字符"
                autoComplete="username"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
              />
              {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">邮箱</label>
              <input
                {...register('email', {
                  required: '请输入邮箱',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入有效的邮箱地址' },
                })}
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: '请输入密码',
                    minLength: { value: 6, message: '密码至少 6 个字符' },
                  })}
                  placeholder="至少 6 个字符"
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'rgba(165,180,252,0.5)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">确认密码</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  {...register('confirmPassword', {
                    required: '请确认密码',
                    validate: (v) => v === password || '两次密码不一致',
                  })}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'rgba(165,180,252,0.5)' }}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && (
              <div
                className="rounded-xl p-3 text-sm text-red-300 border"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-medium text-sm cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? '#16a34a' : '#22C55E', color: '#000' }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  注册中...
                </>
              ) : (
                '注册 →'
              )}
            </button>
          </form>

          <p className="text-center text-sm" style={{ color: 'rgba(165,180,252,0.5)' }}>
            已有账号？{' '}
            <button
              onClick={() => router.push('/login')}
              className="cursor-pointer underline"
              style={{ color: 'rgba(99,102,241,0.8)' }}
            >
              立即登录
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add clients/chat-web/app/register/ clients/chat-web/lib/api.ts
git commit -m "feat(chat-web): add registration page"
```

---

### Task 6: chat-web — Pending page (`/pending`) and login page updates

**Files:**
- Create: `clients/chat-web/app/pending/page.tsx`
- Modify: `clients/chat-web/app/login/page.tsx`
- Modify: `clients/chat-web/app/(chat)/layout.tsx`

**Step 1: Create pending page**

Create `clients/chat-web/app/pending/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0F0F23' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10 text-center space-y-6"
        style={{
          background: '#1a1a2e',
          border: '1px solid rgba(99,102,241,0.2)',
        }}
      >
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(67,56,202,0.2)', border: '2px solid rgba(99,102,241,0.4)' }}
          >
            <Clock className="w-10 h-10 text-indigo-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">账号审批中</h1>
          <p className="text-indigo-200/60 text-sm leading-relaxed">
            您的账号已提交，正在等待管理员审批。
          </p>
          <p className="text-indigo-200/40 text-sm">审批通过后请重新登录。</p>
        </div>

        <button
          onClick={() => router.push('/login')}
          className="w-full h-11 rounded-xl font-medium text-sm cursor-pointer transition-all"
          style={{
            background: 'transparent',
            border: '1px solid rgba(99,102,241,0.4)',
            color: 'rgba(165,180,252,0.8)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.8)';
            (e.target as HTMLElement).style.color = 'rgba(165,180,252,1)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)';
            (e.target as HTMLElement).style.color = 'rgba(165,180,252,0.8)';
          }}
        >
          返回登录
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update chat-web login page — add PENDING redirect and register link**

Read `clients/chat-web/app/login/page.tsx` first.

Make two changes:

Change 1 — In `onSubmit`, replace `router.push('/')` (line 47) with:
```typescript
      if (profile.status === 'PENDING') {
        router.push('/pending');
        return;
      }
      router.push('/');
```

Change 2 — Add register link after the `</form>` closing tag and before the copyright `<p>` (around line 234):
```tsx
          <p className="text-center text-sm" style={{ color: 'rgba(165,180,252,0.5)' }}>
            没有账号？{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="cursor-pointer underline"
              style={{ color: 'rgba(99,102,241,0.8)' }}
            >
              立即注册
            </button>
          </p>
```

**Step 3: Update chat-web layout to guard PENDING users**

Read `clients/chat-web/app/(chat)/layout.tsx` first.

Add a PENDING check after the auth check. The layout currently redirects to `/login` if no user. Add a check for PENDING status after the auth check:

```typescript
  if (user?.status === 'PENDING') {
    redirect('/pending');
  }
```

This provides double protection — even if a PENDING user somehow accesses chat routes directly, they get redirected.

**Step 4: Commit**

```bash
git add clients/chat-web/app/pending/ clients/chat-web/app/login/page.tsx clients/chat-web/app/(chat)/layout.tsx
git commit -m "feat(chat-web): add pending page and PENDING status redirect logic"
```

---

### Task 7: admin-web — Registration approval tab in /users page

**Files:**
- Create: `clients/admin-web/components/users/registration-approval.tsx`
- Modify: `clients/admin-web/app/(dashboard)/users/page.tsx`

**Step 1: Create registration-approval.tsx component**

Read `clients/admin-web/app/(dashboard)/users/page.tsx` to understand the existing imports pattern, especially which shadcn/ui components are available.

Create `clients/admin-web/components/users/registration-approval.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface Registration {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string;
  createdAt: string;
  processedAt?: string;
  user: { id: string; username: string; email: string; realName?: string };
  system: { id: string; name: string; code: string };
  processedBy?: { id: string; username: string };
}

type ActionType = 'approve' | 'reject' | null;

export function RegistrationApproval() {
  const queryClient = useQueryClient();
  const [actionTarget, setActionTarget] = useState<{ id: string; type: ActionType } | null>(null);
  const [note, setNote] = useState('');

  const { data: registrations = [], isLoading, refetch } = useQuery<Registration[]>({
    queryKey: ['registrations', 'PENDING'],
    queryFn: async () => {
      const { data } = await api.get('/registrations?status=PENDING');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.put(`/registrations/${id}/approve`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeDialog();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.put(`/registrations/${id}/reject`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeDialog();
    },
  });

  const closeDialog = () => {
    setActionTarget(null);
    setNote('');
  };

  const handleConfirm = () => {
    if (!actionTarget) return;
    if (actionTarget.type === 'approve') {
      approveMutation.mutate({ id: actionTarget.id, note });
    } else {
      rejectMutation.mutate({ id: actionTarget.id, note });
    }
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button variant="ghost" onClick={() => refetch()} className="cursor-pointer">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>申请系统</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                  暂无待审批申请
                </TableCell>
              </TableRow>
            ) : (
              registrations.map((reg) => (
                <TableRow key={reg.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium font-mono">{reg.user.username}</TableCell>
                  <TableCell>{reg.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{reg.system.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(reg.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionTarget({ id: reg.id, type: 'approve' })}
                        className="h-8 px-2 cursor-pointer hover:bg-green-50 hover:text-green-600"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        通过
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionTarget({ id: reg.id, type: 'reject' })}
                        className="h-8 px-2 cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        拒绝
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.type === 'approve' ? '审批通过确认' : '拒绝确认'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              备注（可选）
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                actionTarget?.type === 'reject' ? '请填写拒绝原因...' : '审批备注...'
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="cursor-pointer">
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className={`cursor-pointer ${
                actionTarget?.type === 'approve'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isPending ? '处理中...' : actionTarget?.type === 'approve' ? '确认通过' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Update users/page.tsx to add 待审批 tab**

Make the following changes to `clients/admin-web/app/(dashboard)/users/page.tsx`:

1. Add import for `RegistrationApproval`:
```typescript
import { RegistrationApproval } from '@/components/users/registration-approval';
```

2. Add import for `useQuery` if not already imported (it already is), and add import for the `Clock` icon in the lucide import:
```typescript
import { Plus, Search, RefreshCw, Edit, Trash, Ban, CheckCircle, Clock } from 'lucide-react';
```

3. Add a `activeTab` state variable after the existing state declarations (around line 47):
```typescript
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
```

4. Add pending count query after the existing `useQuery` for users:
```typescript
  const { data: pendingCountData } = useQuery<{ count: number }>({
    queryKey: ['registrations', 'pending-count'],
    queryFn: async () => {
      const { data } = await api.get('/registrations/pending-count');
      return data;
    },
  });
  const pendingCount = pendingCountData?.count ?? 0;
```

Note: The `pendingCount` query calls a different API (`/registrations/pending-count`), so the `api` instance must have access — admin-web uses `api` from `@/lib/api` which points to user-system, so this is correct.

5. Replace the current page header section with a version that includes tabs. Insert tab buttons between the header and search bar. Add after the closing `</div>` of the header (after line 117):
```tsx
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          全部用户
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          待审批
          {pendingCount > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
```

6. Wrap the existing search bar + table + pagination in a conditional block. Change the search bar div start to:
```tsx
      {activeTab === 'all' ? (
        <>
```
And at the very end, after the `</UserDrawer>` component, close the conditional and add the pending tab content:
```tsx
      ) : (
        <RegistrationApproval />
      )}
```

The UserDrawer should remain outside the conditional (it's already rendered separately).

**Step 3: Verify admin-web builds**

```bash
cd /Users/botycookie/test/llm/clients/admin-web
bun run build 2>&1 | tail -30
```

Expected: No TypeScript errors.

**Step 4: Commit**

```bash
git add clients/admin-web/components/users/registration-approval.tsx clients/admin-web/app/(dashboard)/users/page.tsx
git commit -m "feat(admin-web): add registration approval tab to users page"
```

---

### Task 8: End-to-end smoke test checklist

After all tasks are implemented and services are running, manually verify:

**Registration flow:**
- [ ] Visit `http://localhost:3002/register` — registration form renders correctly
- [ ] Submit with duplicate username — error "用户名已存在" shown
- [ ] Submit with valid new user — redirected to `/pending`
- [ ] Check `/pending` page renders with clock icon and "账号审批中" title
- [ ] Visit `http://localhost:3002/login` — "没有账号？立即注册" link present
- [ ] Login with PENDING user → redirected to `/pending` (not to chat)
- [ ] Navigate directly to `http://localhost:3002/` as PENDING user → redirected to `/pending`

**Approval flow:**
- [ ] Login to admin-web as superadmin (`admin` / `Admin@123456`)
- [ ] Visit `/users` — "待审批 (N)" tab visible with red badge
- [ ] Click 待审批 tab — pending registration appears in table
- [ ] Click "通过" → dialog opens → confirm → registration disappears from list
- [ ] Login to chat-web as the newly approved user → lands on chat interface

**Rejection flow:**
- [ ] Register another new user
- [ ] In admin-web, click "拒绝" → fill reason → confirm
- [ ] Try to login as rejected user → error "账户已被禁用"

**Commit if smoke test passes:**

```bash
git add -A
git commit -m "chore: registration approval system complete"
```
