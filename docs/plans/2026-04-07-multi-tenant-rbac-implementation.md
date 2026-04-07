# Multi-Tenant RBAC System Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce system-level permission isolation so each system admin only sees and manages users within their own system, and prevent privilege escalation via isSuperAdmin.

**Architecture:** Modify `JwtStrategy.validate()` to scope permissions/roles by `currentSystemId` from the user's session. Refactor `UserService` to filter by system instead of department. Strip `isSuperAdmin` from DTOs and harden the approval flow.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Next.js 15, shadcn/ui, React Query

**Design Doc:** `docs/plans/2026-04-07-multi-tenant-rbac-design.md`

---

### Task 1: AuthUser — Add currentSystemId and scope permissions by system

**Files:**
- Modify: `packages/types/src/auth.types.ts`
- Modify: `services/user-system/src/auth/strategies/jwt.strategy.ts`

**Step 1: Add currentSystemId to AuthUser interface**

In `packages/types/src/auth.types.ts`, add after line 19 (`roles: string[];`):

```typescript
  currentSystemId?: string;
```

**Step 2: Modify jwt.strategy.ts validate() to scope permissions by currentSystemId**

Replace the entire `validate()` method (lines 17–64) with:

```typescript
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session) throw new UnauthorizedException('Session revoked');

    const currentSystemId = session.currentSystemId ?? undefined;

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
          // Scope roles to current system when set
          ...(currentSystemId
            ? { where: { role: { systemId: currentSystemId } } }
            : {}),
        },
      },
    });
    if (!user || user.status === 'DISABLED' || user.status === 'LOCKED') {
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

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      realName: user.realName ?? undefined,
      avatar: user.avatar ?? undefined,
      departmentId: user.departmentId ?? undefined,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      currentSystemId,
      permissions,
      roles,
      sessionId: payload.sessionId,
    };
  }
```

Key change: When `currentSystemId` is set, the `include.roles` query adds a `where` filter to only load roles for that system. This means `permissions` and `roles` arrays only contain entries from the current system.

For super admins, `PermissionsGuard` still bypasses permission checks entirely, so the scoped permissions don't restrict them.

**Step 3: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system && bun run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add packages/types/src/auth.types.ts services/user-system/src/auth/strategies/jwt.strategy.ts
git commit -m "feat(user-system): scope permissions by currentSystemId in JWT strategy"
```

---

### Task 2: isSuperAdmin security — strip from DTOs

**Files:**
- Modify: `services/user-system/src/user/dto/create-user.dto.ts`
- Modify: `services/user-system/src/user/user.service.ts` (create method only)

**Step 1: Remove isSuperAdmin from CreateUserDto**

In `services/user-system/src/user/dto/create-user.dto.ts`, remove lines 36-38:

```typescript
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;
```

Also remove `IsBoolean` from the import on line 1 (if no other field uses it).

**Step 2: Force isSuperAdmin to false in UserService.create()**

In `services/user-system/src/user/user.service.ts`, change the `create()` method. Replace the `this.prisma.user.create` call (lines 28-46) with:

```typescript
    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        realName: dto.realName,
        avatar: dto.avatar,
        phone: dto.phone,
        departmentId: dto.departmentId,
        status: dto.status ?? 'ACTIVE',
        isSuperAdmin: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        avatar: true,
        phone: true,
        status: true,
        isSuperAdmin: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
```

Key changes:
- Explicitly list fields instead of `...dto` spread — prevents any unexpected field from being passed to Prisma
- `isSuperAdmin: false` is hardcoded
- `status` defaults to `'ACTIVE'` for admin-created users

Note: `UpdateUserDto` extends `CreateUserDto` via `PartialType(OmitType(...))`. Since `isSuperAdmin` is removed from `CreateUserDto`, it's automatically removed from `UpdateUserDto` too — no separate change needed.

**Step 3: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system && bun run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add services/user-system/src/user/dto/create-user.dto.ts services/user-system/src/user/user.service.ts
git commit -m "fix(user-system): strip isSuperAdmin from DTOs, hardcode false in create"
```

---

### Task 3: UserService — system-scoped create with auto role assignment

**Files:**
- Modify: `services/user-system/src/user/user.service.ts` (create method)
- Modify: `services/user-system/src/user/user.controller.ts` (create handler)
- Modify: `services/user-system/src/user/dto/create-user.dto.ts` (add systemId + roleCode)

**Step 1: Add optional systemId and roleCode to CreateUserDto**

In `services/user-system/src/user/dto/create-user.dto.ts`, add at the end of the class:

```typescript
  @IsOptional()
  @IsString()
  systemId?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;
```

These are used by super admin to specify which system and role to assign. System admins don't send these — the backend uses their `currentSystemId` and defaults to `'USER'`.

**Step 2: Inject currentUser into create controller**

In `services/user-system/src/user/user.controller.ts`, change the create method (lines 17-21):

```typescript
  @Post()
  @Permissions('user:create')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser): Promise<any> {
    return this.userService.create(dto, user);
  }
```

**Step 3: Refactor UserService.create() to accept currentUser and auto-assign role**

Replace the entire `create()` method in `services/user-system/src/user/user.service.ts`:

```typescript
  async create(dto: CreateUserDto, currentUser: AuthUser): Promise<any> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    // Determine target system and role
    let targetSystemId: string;
    let targetRoleCode: string;

    if (currentUser.isSuperAdmin && dto.systemId) {
      // Super admin explicitly specifies system and role
      targetSystemId = dto.systemId;
      targetRoleCode = dto.roleCode || 'USER';
    } else if (currentUser.currentSystemId) {
      // System admin — use their current system, always USER role
      targetSystemId = currentUser.currentSystemId;
      targetRoleCode = 'USER';
    } else {
      throw new BadRequestException('无法确定目标系统');
    }

    // Find the target role
    const targetRole = await this.prisma.role.findFirst({
      where: { systemId: targetSystemId, code: targetRoleCode },
    });
    if (!targetRole) {
      throw new BadRequestException(`系统中不存在角色: ${targetRoleCode}`);
    }

    const hashedPassword = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    const newUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: hashedPassword,
          realName: dto.realName,
          phone: dto.phone,
          status: 'ACTIVE',
          isSuperAdmin: false,
        },
        select: {
          id: true,
          username: true,
          email: true,
          realName: true,
          phone: true,
          status: true,
          isSuperAdmin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: targetRole.id },
      });

      return created;
    });

    return newUser;
  }
```

Key changes:
- Super admin sends `systemId` + optional `roleCode` (defaults to `'USER'`)
- System admin uses `currentSystemId` from their session, always assigns `'USER'` role
- User creation and role assignment are in a transaction
- Removed `departmentId`, `avatar`, `status` from create data — admin-created users don't need department and always start ACTIVE

Also add `BadRequestException` to the import on line 1 if not already present.

**Step 4: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system && bun run build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add services/user-system/src/user/
git commit -m "feat(user-system): system-scoped user creation with auto role assignment"
```

---

### Task 4: UserService — system-scoped findAll and findOne

**Files:**
- Modify: `services/user-system/src/user/user.service.ts` (findAll and findOne methods)

**Step 1: Rewrite findAll to filter by system**

Read `services/user-system/src/user/user.service.ts` first. Replace the `findAll()` method body. The method signature stays `async findAll(query: QueryUserDto, currentUser: AuthUser): Promise<any>`.

Replace the `where` construction logic:

```typescript
  async findAll(query: QueryUserDto, currentUser: AuthUser): Promise<any> {
    const { username, email, departmentId, page = 1, pageSize = 10 } = query;

    const where: any = {};

    // System-scoped filtering: non-super admins only see users in their current system
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      where.roles = {
        some: {
          role: { systemId: currentUser.currentSystemId },
        },
      };
    }

    if (username) {
      where.username = { contains: username };
    }

    if (email) {
      where.email = { contains: email };
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          realName: true,
          avatar: true,
          phone: true,
          status: true,
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
```

Key change: `where.departmentId = currentUser.departmentId` replaced with `where.roles = { some: { role: { systemId: currentUser.currentSystemId } } }`.

**Step 2: Rewrite findOne to check system access**

Replace the `findOne()` method:

```typescript
  async findOne(id: string, currentUser: AuthUser): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
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

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // System-scoped access check
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      const hasSystemRole = user.roles.some(
        (ur) => ur.role.systemId === currentUser.currentSystemId,
      );
      if (!hasSystemRole) {
        throw new ForbiddenException('无权访问该用户');
      }
    }

    const { password, ...result } = user;
    return result;
  }
```

Key change: Department check replaced with system-based role check.

**Step 3: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system && bun run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add services/user-system/src/user/user.service.ts
git commit -m "feat(user-system): system-scoped user listing and access checks"
```

---

### Task 5: UserService — system-scoped assignRoles

**Files:**
- Modify: `services/user-system/src/user/user.service.ts` (assignRoles method)

**Step 1: Add system validation to assignRoles**

Read the current `assignRoles()` method. Add system-scoping logic at the start:

```typescript
  async assignRoles(userId: string, systemRoles: { systemId: string; roleIds: string[] }[], currentUser: AuthUser) {
    await this.findOne(userId, currentUser);

    // System admin can only assign roles in their current system
    if (!currentUser.isSuperAdmin && currentUser.currentSystemId) {
      const invalidSystem = systemRoles.find(
        (sr) => sr.systemId !== currentUser.currentSystemId,
      );
      if (invalidSystem) {
        throw new ForbiddenException('无权分配其他系统的角色');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const systemIds = systemRoles.map((sr) => sr.systemId);

      await tx.userRole.deleteMany({
        where: {
          userId,
          role: {
            systemId: { in: systemIds },
          },
        },
      });

      const roleAssignments = systemRoles.flatMap((sr) =>
        sr.roleIds.map((roleId) => ({ userId, roleId })),
      );

      if (roleAssignments.length > 0) {
        await tx.userRole.createMany({
          data: roleAssignments,
        });
      }
    });

    return { message: '角色分配成功' };
  }
```

**Step 2: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system && bun run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add services/user-system/src/user/user.service.ts
git commit -m "feat(user-system): system-scoped role assignment validation"
```

---

### Task 6: Registration approval — harden USER role check

**Files:**
- Modify: `services/user-system/src/registration/registration.service.ts`

**Step 1: Throw error when USER role doesn't exist**

In `services/user-system/src/registration/registration.service.ts`, find the approve method. Replace lines 73-75 and 93-99:

Change from:
```typescript
    const userRole = await this.prisma.role.findFirst({
      where: { systemId: registration.systemId, code: 'USER' },
    });
```

To:
```typescript
    const userRole = await this.prisma.role.findFirst({
      where: { systemId: registration.systemId, code: 'USER' },
    });
    if (!userRole) {
      throw new BadRequestException('该系统未配置默认用户角色(USER)，无法完成审批');
    }
```

And change from:
```typescript
      if (userRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: registration.userId, roleId: userRole.id } },
          update: {},
          create: { userId: registration.userId, roleId: userRole.id },
        });
      }
```

To (remove the `if` wrapper):
```typescript
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: registration.userId, roleId: userRole.id } },
        update: {},
        create: { userId: registration.userId, roleId: userRole.id },
      });
```

**Step 2: Verify build**

```bash
cd /Users/botycookie/test/llm/services/user-system && bun run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add services/user-system/src/registration/registration.service.ts
git commit -m "fix(user-system): throw error when USER role missing during approval"
```

---

### Task 7: admin-web UserDrawer — context-aware form

**Files:**
- Modify: `clients/admin-web/components/users/user-drawer.tsx`

**Step 1: Rewrite UserDrawer to support super admin and system admin modes**

Read `clients/admin-web/components/users/user-drawer.tsx` first. The drawer needs to:

1. Import `useAuthStore` to get `isSuperAdmin` from current user
2. In create mode:
   - **Super admin**: Show system select + role select (SYSTEM_ADMIN / USER), hide department
   - **System admin**: Only show username/email/password, hide system/department/role/status
3. In edit mode: Keep existing behavior (name, email, phone, department, status) — no system/role changes in edit

Key changes to the component:

- Add auth store import and get user info
- Add systems list fetch for super admin mode
- Remove department field from create mode (keep in edit mode)
- Add system select (super admin only) and role select (super admin only) in create mode
- Remove status field from create mode (always ACTIVE)
- Modify `onSubmit` to send `systemId` and `roleCode` in create payload for super admin

The `UserForm` interface adds:
```typescript
  systemId?: string;
  roleCode?: string;
```

The form conditionally renders:
```tsx
{/* Create mode — super admin: show system + role */}
{!isEdit && user?.isSuperAdmin && (
  <>
    <SystemSelect />
    <RoleSelect />  {/* SYSTEM_ADMIN or USER */}
  </>
)}

{/* Create mode — system admin: minimal form */}
{/* username, email, password only */}

{/* Edit mode: keep existing fields (name, phone, department, status) */}
```

Systems are fetched via `GET /systems` (already exists in the system module).

The full component code should be written by the implementer following the above pattern, using the existing shadcn/ui Select component already imported.

**Step 2: Verify the page works by running dev**

```bash
cd /Users/botycookie/test/llm && bun run dev:admin-web
```

Manually check: open UserDrawer as super admin → see system+role selects. Open as system admin → see minimal form.

**Step 3: Commit**

```bash
git add clients/admin-web/components/users/user-drawer.tsx
git commit -m "feat(admin-web): context-aware UserDrawer for super admin and system admin"
```
