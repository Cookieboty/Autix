# 用户注册与审批系统设计文档

**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** user-system 注册接口 + chat-web 注册/审批页面 + admin-web 审批管理

---

## 需求概述

1. chat-web 用户可以自助注册，注册后进入"待审批"状态
2. chat 系统的系统管理员（SYSTEM_ADMIN 角色）在 admin-web 中审批注册申请
3. 系统管理员只能由超级管理员（isSuperAdmin=true）创建（即将 SYSTEM_ADMIN 角色分配给用户）
4. 同一用户可以成为多个系统的管理员
5. 待审批用户可以登录，但 chat-web 显示"审批中"页面，无法使用功能
6. 无需邮件通知，用户自行返回登录查看状态

---

## 系统范围

当前仅设计 **chat 系统**的注册审批流程，架构上支持扩展到其他系统。

---

## 数据模型变更

### 1. UserStatus 枚举新增 PENDING

文件: `packages/database/prisma/schema.prisma`

```prisma
enum UserStatus {
  ACTIVE
  DISABLED
  LOCKED
  PENDING    // 新增：注册后等待管理员审批
}
```

### 2. 新增 SystemRegistration 表

```prisma
model SystemRegistration {
  id            String             @id @default(cuid())
  userId        String
  systemId      String
  status        RegistrationStatus @default(PENDING)
  note          String?            // 管理员审批备注
  createdAt     DateTime           @default(now())
  processedAt   DateTime?
  processedById String?            // 审批人 userId

  user          User    @relation("UserRegistrations", fields: [userId], references: [id], onDelete: Cascade)
  system        System  @relation(fields: [systemId], references: [id])
  processedBy   User?   @relation("ProcessedRegistrations", fields: [processedById], references: [id])

  @@unique([userId, systemId])
  @@map("system_registrations")
}

enum RegistrationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### 3. User 和 System 模型新增反向关联

```prisma
model User {
  // ... 现有字段
  registrations     SystemRegistration[] @relation("UserRegistrations")
  processedRegs     SystemRegistration[] @relation("ProcessedRegistrations")
}

model System {
  // ... 现有字段
  registrations     SystemRegistration[]
}
```

---

## 系统管理员机制

- 每个系统通过 Role 表管理管理员，约定 code 为 `SYSTEM_ADMIN`
- chat 系统在初始化时（seed）创建一个 `code=SYSTEM_ADMIN` 的 Role
- 只有 `isSuperAdmin=true` 的用户可以将 SYSTEM_ADMIN 角色分配给其他用户
- 权限校验：拥有某系统 SYSTEM_ADMIN 角色的用户，可以操作该系统的注册审批

---

## 后端接口（user-system）

### 新增模块：registration

**文件结构:**
```
services/user-system/src/registration/
  registration.module.ts
  registration.controller.ts
  registration.service.ts
  dto/
    create-registration.dto.ts   (register 请求体)
    process-registration.dto.ts  (approve/reject 请求体)
```

### 接口定义

#### 1. POST /auth/register（Public）
注册新用户

**Request:**
```json
{
  "username": "string (3-20字符，唯一)",
  "email": "string (valid email，唯一)",
  "password": "string (min 6字符)",
  "systemCode": "chat"
}
```

**Logic:**
1. 校验 username/email 唯一性，失败返回 400
2. bcrypt hash password
3. 创建 `User { status: PENDING }`
4. 查找 systemCode 对应的 System 记录
5. 创建 `SystemRegistration { userId, systemId, status: PENDING }`
6. 返回 `{ message: "注册成功，等待管理员审批" }`

---

#### 2. GET /registrations（需登录 + 系统管理权限）
获取注册申请列表

**Query:** `?systemId=xxx&status=PENDING`

**Logic:**
- 验证当前用户是否拥有该 systemId 的 SYSTEM_ADMIN 角色（或 isSuperAdmin）
- 返回过滤后的 SystemRegistration 列表（含 user 基础信息）

---

#### 3. PUT /registrations/:id/approve（需系统管理权限）
审批通过

**Request:** `{ note?: string }`

**Logic (事务):**
1. 查找 SystemRegistration，验证权限
2. 检查 status 为 PENDING
3. `SystemRegistration.status = APPROVED`, `processedAt = now()`, `processedById = currentUser.id`
4. `User.status = ACTIVE`
5. 查找该系统的默认用户角色（code = `USER` 或 `MEMBER`），为用户分配
6. 返回 `{ message: "审批通过" }`

---

#### 4. PUT /registrations/:id/reject（需系统管理权限）
审批拒绝

**Request:** `{ note?: string }`

**Logic (事务):**
1. 查找 SystemRegistration，验证权限
2. `SystemRegistration.status = REJECTED`, processedAt/processedById 同上
3. `User.status = DISABLED`
4. 返回 `{ message: "已拒绝" }`

---

### auth.service 变更

`login()` 方法调整：
- `PENDING` 状态：**允许登录**，正常颁发 JWT，`getProfile()` 返回的 user 中包含 `status: 'PENDING'`
- 前端根据 `status` 判断跳转
- `DISABLED/LOCKED` 状态：仍然拒绝登录（现有逻辑不变）

**变更点：** 移除 `if (user.status !== 'ACTIVE') throw UnauthorizedException` 这一行，改为仅对 DISABLED/LOCKED 抛出异常。

---

## 前端变更

### chat-web

#### 新增页面

**1. `/register` — 注册页**

布局与 `/login` 完全一致（分屏，左侧品牌面板复用）

右侧表单字段：
- 用户名（required, 3-20字符）
- Email（required, valid email）
- 密码（required, min 6字符）
- 确认密码（required, 与密码一致）
- `[ 注册 → ]` 绿色按钮
- 底部："已有账号？ [登录]"

提交逻辑：
- 调用 `POST /auth/register`（userApi）
- 成功 → 跳转 `/pending`
- 失败 → 显示错误（用户名已存在 / Email 已存在 / 服务错误）

**2. `/pending` — 审批中页面**

```
全屏深空背景（与登录页一致）
居中卡片（max-w-md）：
  [Clock icon，大，indigo 色]
  "账号审批中"（标题）
  "您的账号已提交，正在等待管理员审批。"
  "审批通过后请重新登录。"
  [ 返回登录 ] 按钮（outline 样式）
```

**3. 登录流程变更**

`/login` 的 `onSubmit` 在 `setUser` 后：
```typescript
if (profile.status === 'PENDING') {
  router.push('/pending');
  return;
}
router.push('/');
```

**4. 登录页新增注册入口**

在登录按钮下方添加：
```
没有账号？ [立即注册]  → router.push('/register')
```

---

### admin-web

#### 用户管理页 `/users` 新增"待审批"Tab

**Tab 切换：**
```
[全部用户] [待审批 (N)]
```
- 待审批 Tab 角标显示未处理数量

**待审批列表列：**
| 用户名 | Email | 申请系统 | 注册时间 | 操作 |
|--------|-------|----------|----------|------|
| admin  | a@b.c | Chat     | 2024-01-01 | [通过] [拒绝] |

**审批操作：**
- 点击"通过"→ 弹窗确认 + 可选备注 → 调用 `PUT /registrations/:id/approve`
- 点击"拒绝"→ 弹窗填写拒绝原因 → 调用 `PUT /registrations/:id/reject`

**权限控制：**
- 只有拥有 SYSTEM_ADMIN 角色（或 isSuperAdmin）的用户才能看到该 Tab
- 只显示当前用户有管理权限的系统的注册申请

---

## 权限总结

| 操作 | 所需权限 |
|------|---------|
| 注册 | 无（Public） |
| 登录（PENDING 状态） | 无（允许登录，前端拦截） |
| 查看注册申请列表 | SYSTEM_ADMIN 角色（对应系统）或 isSuperAdmin |
| 审批注册申请 | SYSTEM_ADMIN 角色（对应系统）或 isSuperAdmin |
| 创建 SYSTEM_ADMIN 角色用户 | isSuperAdmin |

---

## 初始化数据（Seed）

chat 系统需要预置：
1. System 记录：`{ name: "Chat", code: "chat", status: ACTIVE }`
2. Role 记录（chat 系统）：`{ code: "SYSTEM_ADMIN", name: "系统管理员" }`
3. Role 记录（chat 系统）：`{ code: "USER", name: "普通用户" }`（审批通过后默认分配）

---

## 变更文件清单

### packages/database
- `prisma/schema.prisma` — 新增 PENDING status、SystemRegistration 表

### services/user-system
- `src/auth/auth.service.ts` — 调整 login() PENDING 逻辑
- `src/auth/auth.controller.ts` — 新增 POST /auth/register
- `src/auth/dto/login.dto.ts` — 新增 RegisterDto
- `src/registration/` — 新建模块（controller, service, dto）
- `src/app.module.ts` — 引入 RegistrationModule

### clients/chat-web
- `app/register/page.tsx` — 新建注册页
- `app/pending/page.tsx` — 新建审批中页面
- `app/login/page.tsx` — 新增注册入口链接，登录后检查 status
- `app/(chat)/layout.tsx` — 增加 PENDING 状态检测（双重保护）

### clients/admin-web
- `app/(dashboard)/users/page.tsx` — 新增"待审批"Tab
- `components/users/registration-approval.tsx` — 新建审批组件
