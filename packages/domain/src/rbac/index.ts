/**
 * T15.9: rbac 层的"权限主体"最小契约，取代对 `AuthUser` 的直接依赖，
 * 以便 auth 域可以反过来 import rbac 里的 `Menu / SystemInfo` 而不制造循环。
 * 任何具备 `permissions[]`（可选 `isSuperAdmin`）的对象都能被 rbac helpers 检查。
 */
export interface RbacSubject {
  permissions?: unknown[];
  isSuperAdmin?: boolean;
}

export interface Menu {
  id: string;
  name: string;
  path: string;
  icon?: string;
  parentId?: string | null;
  sort: number;
  visible: boolean;
}

export interface SystemInfo {
  id: string;
  name: string;
  code: string;
}

export function checkAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const u = user as Record<string, unknown>;
  if (u.isSuperAdmin === true) return true;
  const roles = Array.isArray(u.roles) ? (u.roles as unknown[]) : [];
  return roles.some((r) => {
    if (typeof r === 'string') return r === 'SYSTEM_ADMIN';
    if (r && typeof r === 'object') {
      const role = (r as Record<string, unknown>).role ?? r;
      return (role as Record<string, unknown>).code === 'SYSTEM_ADMIN';
    }
    return false;
  });
}

export function hasPermission(user: RbacSubject | null, permission: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const permissions = Array.isArray(user.permissions)
    ? user.permissions.map((p) => (typeof p === 'string' ? p : (p as { code: string }).code))
    : [];
  return permissions.includes(permission);
}

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
