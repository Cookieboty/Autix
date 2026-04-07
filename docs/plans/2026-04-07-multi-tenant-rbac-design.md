# 多租户 RBAC 系统级隔离改造设计

**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** user-system 权限隔离 + 用户管理系统级过滤 + 安全加固

---

## 需求概述

1. 权限按当前系统（`currentSystemId`）隔离，JWT 不再合并所有系统的权限
2. 系统管理员只能看到和操作本系统用户
3. 系统管理员创建用户时自动分配本系统 USER 角色，不需选择系统或部门
4. 超级管理员创建系统管理员时选择系统，自动分配 SYSTEM_ADMIN 角色
5. isSuperAdmin 仅通过种子数据创建，API 不允许设置
6. 审批通过时若 USER 角色不存在应报错

---

## 方案：Session 级系统隔离

复用现有 `UserSession.currentSystemId` + `PUT /auth/switch-system` 机制，在 JWT Strategy 层按 `currentSystemId` 过滤权限。

---

## 变更清单

### 1. AuthUser 改造 — 权限系统级隔离

**文件:** `services/user-system/src/auth/strategies/jwt.strategy.ts`

`validate()` 方法改造：
1. 从 `UserSession` 读取 `currentSystemId`
2. 只加载 `currentSystemId` 下的 `UserRole → Role → RolePermission → Permission`
3. `roles` 只含当前系统的角色 code
4. 将 `currentSystemId` 加入返回的 AuthUser

**文件:** `packages/types/src/auth.types.ts`

AuthUser 接口新增：
```typescript
currentSystemId?: string;
```

**超级管理员行为**：isSuperAdmin=true 时，permissions/roles 加载当前系统的全部权限（通过 System → Menu → Permission 链），PermissionsGuard 仍然直接放行不变。

---

### 2. UserService — 用户管理系统级隔离

**文件:** `services/user-system/src/user/user.service.ts`

#### findAll() 改造

当前：按 `departmentId` 过滤  
改为：
- 超管 (`isSuperAdmin=true`)：不过滤，看到所有用户
- 系统管理员：只看到在 `currentSystemId` 下有 UserRole 的用户
- 具体查询：`WHERE id IN (SELECT userId FROM user_roles ur JOIN roles r ON ur.roleId = r.id WHERE r.systemId = currentSystemId)`

#### findOne() 改造

当前：按 `departmentId` 校验  
改为：
- 超管：无限制
- 系统管理员：目标用户必须在 `currentSystemId` 下有角色，否则 403

#### create() 改造

当前：不关联系统  
改为：
- 接收 `currentUser: AuthUser`（controller 已改为传入完整 AuthUser）
- 超管创建时：接收 `systemId` 参数 + `roleCode` 参数（`SYSTEM_ADMIN` 或 `USER`）
- 系统管理员创建时：自动使用 `currentUser.currentSystemId`，自动分配该系统 `code='USER'` 的角色
- 用户状态直接设为 `ACTIVE`（手动创建不需要审批）
- 创建+角色分配在事务中执行

#### assignRoles() 改造

当前：无系统校验  
改为：
- 超管：无限制
- 系统管理员：校验所有 `roleIds` 的 `systemId === currentSystemId`，不匹配则 403

---

### 3. isSuperAdmin 安全加固

**文件:** `services/user-system/src/user/dto/create-user.dto.ts`

- 移除 `isSuperAdmin` 字段（或保留字段但在 service 层强制忽略）

**文件:** `services/user-system/src/user/user.service.ts`

- `create()` 中强制 `isSuperAdmin: false`，即使请求体中包含也无效

**文件:** `services/user-system/src/user/dto/update-user.dto.ts`

- 移除 `isSuperAdmin` 字段，防止通过 PATCH 提权

---

### 4. 审批流程加固

**文件:** `services/user-system/src/registration/registration.service.ts`

`approve()` 方法：
- 当前：`if (userRole)` — USER 角色不存在时静默跳过
- 改为：USER 角色不存在时抛出 `BadRequestException('该系统未配置默认用户角色(USER)，无法完成审批')`

---

### 5. 前端 admin-web 改造

**文件:** `clients/admin-web/components/users/user-drawer.tsx`

UserDrawer 根据调用者身份显示不同表单：

**超管模式** (`isSuperAdmin=true`)：
- 系统选择（下拉，必选，列出所有 ACTIVE 系统）
- 角色选择：系统管理员 / 普通用户
- 用户名、邮箱、密码
- 不显示部门

**系统管理员模式**：
- 用户名、邮箱、密码
- 不显示系统选择（自动用当前系统）
- 不显示部门
- 不显示角色选择（自动分配 USER）

---

## 权限总结

| 操作 | 超级管理员 | 系统管理员 |
|------|-----------|-----------|
| 创建系统管理员 | 选择系统 → 分配 SYSTEM_ADMIN | 不可操作 |
| 创建普通用户 | 选择系统 → 分配 USER | 自动当前系统 → 分配 USER |
| 用户列表 | 所有用户 | 仅当前系统用户 |
| 角色分配 | 任意系统 | 仅当前系统角色 |
| 审批注册 | 所有系统 | 仅 SYSTEM_ADMIN 所在系统 |
| 设置 isSuperAdmin | 不可（仅种子数据） | 不可 |

---

## 不需要改动的部分

- **数据模型**：不新增表，不改 schema
- **注册流程**：chat-web 注册 → 审批 → USER 角色分配 → 可用（不变）
- **登录/JWT**：JWT payload 不变（sub, username, sessionId），权限在 validate 时从 DB 加载
- **PermissionsGuard**：逻辑不变，因为 AuthUser.permissions 已经是系统级的
- **切换系统 API**：`PUT /auth/switch-system` 不变，切换后前端重新获取 profile

---

## 变更文件清单

### packages/types
- `src/auth.types.ts` — AuthUser 新增 `currentSystemId`

### services/user-system
- `src/auth/strategies/jwt.strategy.ts` — validate() 按 currentSystemId 过滤权限
- `src/user/user.service.ts` — findAll/findOne 按系统过滤，create 自动分配角色，assignRoles 校验系统
- `src/user/user.controller.ts` — create 传入 currentUser
- `src/user/dto/create-user.dto.ts` — 移除 isSuperAdmin
- `src/user/dto/update-user.dto.ts` — 移除 isSuperAdmin
- `src/registration/registration.service.ts` — approve 加固 USER 角色不存在时报错

### clients/admin-web
- `components/users/user-drawer.tsx` — 根据角色显示不同表单
