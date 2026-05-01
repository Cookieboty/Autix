import type { AuthUser } from '@autix/types';

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
  return roles.includes('SYSTEM_ADMIN');
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  if ((user as AuthUser & { isSuperAdmin?: boolean }).isSuperAdmin) return true;
  const permissions = Array.isArray(user.permissions)
    ? user.permissions.map((p) => (typeof p === 'string' ? p : (p as { code: string }).code))
    : [];
  return permissions.includes(permission);
}
