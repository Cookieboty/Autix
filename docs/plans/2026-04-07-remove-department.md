# Remove Department Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all department-related code from frontend and backend, and drop the Department table via Prisma migration.

**Architecture:** Delete backend module, strip department fields from DTOs and service, drop DB column/table via migration, then clean up frontend pages/components/references.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 15, TypeScript

---

### Task 1: Remove department from backend DTOs

**Files:**
- Modify: `services/user-system/src/user/dto/create-user.dto.ts`
- Modify: `services/user-system/src/user/dto/query-user.dto.ts`

**Step 1: Remove `departmentId` from `create-user.dto.ts`**

Delete these lines:
```typescript
  @IsOptional()
  @IsString()
  departmentId?: string;
```

**Step 2: Remove `departmentId` from `query-user.dto.ts`**

Delete these lines:
```typescript
  @IsOptional()
  @IsString()
  departmentId?: string;
```

**Step 3: Commit**
```bash
git add services/user-system/src/user/dto/
git commit -m "chore: remove departmentId from user DTOs"
```

---

### Task 2: Remove department from UserService

**Files:**
- Modify: `services/user-system/src/user/user.service.ts`

**Step 1: Remove `departmentId` from `findAll` query destructuring and `where` clause**

In `findAll`, change:
```typescript
const { username, email, departmentId, page = 1, pageSize = 10 } = query;
```
to:
```typescript
const { username, email, page = 1, pageSize = 10 } = query;
```

And remove:
```typescript
    if (departmentId) {
      where.departmentId = departmentId;
    }
```

**Step 2: Remove `department` and `departmentId` from `findAll` select**

Remove from the `select` block:
```typescript
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
```

**Step 3: Remove `department` and `departmentId` from `findMany` select in `findAll`**

Also remove the `roles` include added for systems display — keep only what's needed. The `roles` include for system display should stay. Only remove `departmentId` and `department`.

**Step 4: Commit**
```bash
git add services/user-system/src/user/user.service.ts
git commit -m "chore: remove department from user service"
```

---

### Task 3: Remove DepartmentModule from app

**Files:**
- Modify: `services/user-system/src/app.module.ts`
- Delete: `services/user-system/src/department/` (entire directory)

**Step 1: Remove DepartmentModule from `app.module.ts`**

Remove the import line:
```typescript
import { DepartmentModule } from './department/department.module';
```

And remove `DepartmentModule` from the `imports` array.

**Step 2: Delete the department directory**
```bash
rm -rf services/user-system/src/department
```

**Step 3: Commit**
```bash
git add services/user-system/src/app.module.ts
git commit -m "chore: remove DepartmentModule"
```

---

### Task 4: Update Prisma schema — remove Department model and User.departmentId

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Remove `Department` model entirely**

Delete the entire block:
```prisma
model Department {
  id          String       @id @default(cuid())
  name        String
  code        String       @unique
  description String?
  sort        Int          @default(0)
  parentId    String?
  parent      Department?  @relation("DepartmentTree", fields: [parentId], references: [id])
  children    Department[] @relation("DepartmentTree")
  users       User[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@map("departments")
}
```

**Step 2: Remove department fields from `User` model**

Remove from the `User` model:
```prisma
  departmentId String?
  department   Department?   @relation(fields: [departmentId], references: [id])
```

**Step 3: Generate and apply migration**
```bash
cd packages/database
npx prisma migrate dev --name remove_department
```

Expected: migration file created, `departments` table dropped, `departmentId` column removed from `users`.

**Step 4: Commit**
```bash
git add packages/database/prisma/
git commit -m "chore(db): remove Department model and User.departmentId"
```

---

### Task 5: Remove department from frontend — users page

**Files:**
- Modify: `clients/admin-web/app/(dashboard)/users/page.tsx`

**Step 1: Remove `departmentId` and `department` from `User` interface**

Change:
```typescript
  departmentId?: string;
  department?: { id: string; name: string; code: string };
```
to nothing (delete both lines).

**Step 2: Remove 部门 column from table header**

Delete:
```tsx
<TableHead>部门</TableHead>
```

**Step 3: Remove 部门 cell from table rows**

Delete:
```tsx
<TableCell>{user.department?.name || '-'}</TableCell>
```

**Step 4: Update colSpan from 8 to 7**

Change both `colSpan={8}` to `colSpan={7}`.

**Step 5: Commit**
```bash
git add clients/admin-web/app/(dashboard)/users/page.tsx
git commit -m "chore(admin-web): remove department column from users table"
```

---

### Task 6: Remove department from UserDrawer

**Files:**
- Modify: `clients/admin-web/components/users/user-drawer.tsx`

**Step 1: Remove `Department` interface**

Delete:
```typescript
interface Department {
  id: string;
  name: string;
}
```

**Step 2: Remove `departments` state and `loadDepartments` call**

Remove:
```typescript
  const [departments, setDepartments] = useState<Department[]>([]);
```

Remove the `loadDepartments()` call in `useEffect`.

Remove the entire `loadDepartments` function.

**Step 3: Remove `departmentId` from form reset**

In the `reset({...})` call for edit mode, remove:
```typescript
          departmentId: user.departmentId || '',
```

**Step 4: Remove department Select field from JSX**

Delete the entire department section:
```tsx
            {/* Department — edit mode only */}
            {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">所属部门</Label>
              <Select
                value={departmentId || 'none'}
                onValueChange={(val) => setValue('departmentId', val === 'none' ? '' : val)}
              >
                ...
              </Select>
            </div>
            )}
```

**Step 5: Remove `departmentId` from `UserForm` interface and `watch`**

Remove from `UserForm`:
```typescript
  departmentId?: string;
```

Remove:
```typescript
  const departmentId = watch('departmentId');
```

**Step 6: Commit**
```bash
git add clients/admin-web/components/users/user-drawer.tsx
git commit -m "chore(admin-web): remove department from UserDrawer"
```

---

### Task 7: Delete departments page and component

**Files:**
- Delete: `clients/admin-web/app/(dashboard)/departments/page.tsx`
- Delete: `clients/admin-web/components/departments/department-drawer.tsx`

**Step 1: Delete files**
```bash
rm clients/admin-web/app/(dashboard)/departments/page.tsx
rm -rf clients/admin-web/components/departments/
```

**Step 2: Commit**
```bash
git add -A clients/admin-web/app/(dashboard)/departments/
git add -A clients/admin-web/components/departments/
git commit -m "chore(admin-web): delete departments page and drawer"
```

---

### Task 8: Remove department references from dashboard and profile pages

**Files:**
- Modify: `clients/admin-web/app/(dashboard)/page.tsx`
- Modify: `clients/admin-web/app/(dashboard)/profile/page.tsx`

**Step 1: Clean up `page.tsx` (dashboard)**

Remove from the stats interface:
```typescript
  departments: number;
```

Remove from the parallel API calls:
```typescript
        api.get('/departments').then(res => res.data.length),
```
(adjust destructuring accordingly)

Remove the departments stat card and the "新增部门" quick action entry.

**Step 2: Clean up `profile/page.tsx`**

Remove the line:
```tsx
<p className="mt-1">{user.departmentId || '-'}</p>
```
and its surrounding label/container if it only served department display.

**Step 3: Commit**
```bash
git add clients/admin-web/app/(dashboard)/page.tsx
git add clients/admin-web/app/(dashboard)/profile/page.tsx
git commit -m "chore(admin-web): remove department from dashboard and profile"
```

---

### Task 9: Final verification

**Step 1: Build backend**
```bash
cd services/user-system && npx tsc --noEmit
```
Expected: no errors.

**Step 2: Build frontend**
```bash
cd clients/admin-web && npx tsc --noEmit
```
Expected: no errors.

**Step 3: Final commit**
```bash
git add -A
git commit -m "chore: complete department removal"
```
