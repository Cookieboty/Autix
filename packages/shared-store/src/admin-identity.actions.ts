import { userApi } from '@autix/sdk';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING' | 'DELETED';
}

export interface AdminSystem {
  id: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  sort?: number;
  autoApprove?: boolean;
}

export interface AdminRole {
  id: string;
  name: string;
  code: string;
  description?: string;
  sort?: number;
}

export interface AdminRoleListItem extends AdminRole {
  sort: number;
  createdAt: string;
  _count: { users: number; permissions: number };
}

export interface AdminPermission {
  id: string;
  name: string;
  code: string;
  action: string;
  type: 'FRONTEND' | 'BACKEND';
}

export interface AdminMenu {
  id: string;
  name: string;
  code: string;
  icon?: string;
  path: string;
  parentId?: string | null;
  sort: number;
  visible: boolean;
  children: AdminMenu[];
  permissions: AdminPermission[];
}

export interface AdminPermissionSystem {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: string;
  sort: number;
  menus: AdminMenu[];
}

export interface AdminSystemRoleGroup {
  systemId: string;
  systemName: string;
  systemCode: string;
  roles: AdminRole[];
}

export interface AdminRegistration {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string;
  createdAt: string;
  processedAt?: string;
  user: { id: string; username: string; email: string; realName?: string };
  system: { id: string; name: string; code: string };
  processedBy?: { id: string; username: string };
}

export interface AdminDashboardStats {
  users: number;
  roles: number;
  permissions: number;
  systems: number;
  menus: number;
}

export interface AdminRecentUser {
  realName?: string;
  username: string;
  createdAt: string;
}

export interface AdminUserListItem extends AdminUser {
  roles?: Array<{
    role: {
      id: string;
      name: string;
      code: string;
      system: { id: string; name: string; code: string };
    };
  }>;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminUserListResponse {
  list: AdminUserListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface AdminRoleFormInput {
  name: string;
  code: string;
  description?: string;
  sort?: number;
}

export interface AdminUserFormInput {
  username: string;
  email: string;
  password?: string;
  realName?: string;
  phone?: string;
  status?: string;
  systemId?: string;
  roleCode?: string;
}

export interface AdminUserSystemRolesInput {
  systemRoles: Array<{
    systemId: string;
    roleIds: string[];
  }>;
}

export interface AdminSystemFormInput {
  name: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  sort: number;
  autoApprove: boolean;
}

export interface AdminMenuFormInput {
  systemId: string;
  name: string;
  code: string;
  path: string;
  icon?: string;
  parentId?: string;
  sort: number;
  visible: boolean;
}

export interface AdminPermissionFormInput {
  menuId: string;
  name: string;
  code: string;
  type: 'FRONTEND' | 'BACKEND';
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT';
  description?: string;
}

export interface AdminUserListParams {
  page: number;
  pageSize?: number;
  username?: string;
  includeDeleted?: boolean;
}

export interface AdminPasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

interface CountListResponse {
  list?: unknown[];
  data?: unknown[];
  length?: number;
}

interface PaginatedCountResponse {
  pagination?: {
    total?: number;
  };
  total?: number;
}

const toRoleList = (data: AdminRole[] | { list?: AdminRole[] }): AdminRole[] => {
  if (Array.isArray(data)) return data;
  return data.list ?? [];
};

const readListCount = (data: CountListResponse | unknown): number => {
  if (!data || typeof data !== 'object') return 0;
  if ('list' in data && Array.isArray(data.list)) return data.list.length;
  if ('data' in data && Array.isArray(data.data)) return data.data.length;
  if ('length' in data && typeof data.length === 'number') return data.length;
  return 0;
};

const readPaginatedTotal = (data: PaginatedCountResponse): number =>
  data.pagination?.total ?? data.total ?? 0;

const toUserListResponse = (raw: any): AdminUserListResponse => ({
  list: raw.data ?? raw.list ?? [],
  pagination: raw.pagination ?? {
    total: raw.total ?? 0,
    page: raw.page ?? 1,
    pageSize: raw.pageSize ?? 10,
    totalPages: raw.totalPages ?? 1,
  },
});

export const adminIdentityActions = {
  listSystems: async () => {
    const { data } = await userApi.get<AdminSystem[]>('/systems');
    return data;
  },
  listRolesBySystem: async (systemId: string) => {
    const { data } = await userApi.get<AdminRole[] | { list?: AdminRole[] }>(
      `/roles?systemId=${systemId}`,
    );
    return toRoleList(data);
  },
  listRoles: async () => {
    const { data } = await userApi.get<AdminRoleListItem[] | { list?: AdminRoleListItem[] }>(
      '/roles',
    );
    if (Array.isArray(data)) return data;
    return data.list ?? [];
  },
  createRole: (data: AdminRoleFormInput) => userApi.post('/roles', data),
  updateRole: (roleId: string, data: AdminRoleFormInput) =>
    userApi.patch(`/roles/${roleId}`, data),
  deleteRole: (roleId: string) => userApi.delete(`/roles/${roleId}`),
  getPermissionTree: async () => {
    const { data } = await userApi.get<AdminPermissionSystem[]>('/permission-tree');
    return data;
  },
  createSystem: (data: AdminSystemFormInput) => userApi.post('/systems', data),
  updateSystem: (systemId: string, data: AdminSystemFormInput) =>
    userApi.patch(`/systems/${systemId}`, data),
  deleteSystem: (systemId: string) => userApi.delete(`/systems/${systemId}`),
  createMenu: (data: AdminMenuFormInput) => userApi.post('/menus', data),
  updateMenu: (menuId: string, data: AdminMenuFormInput) =>
    userApi.put(`/menus/${menuId}`, data),
  deleteMenu: (menuId: string) => userApi.delete(`/menus/${menuId}`),
  createPermission: (data: AdminPermissionFormInput) =>
    userApi.post('/permissions', data),
  updatePermission: (permissionId: string, data: AdminPermissionFormInput) =>
    userApi.put(`/permissions/${permissionId}`, data),
  deletePermission: (permissionId: string) =>
    userApi.delete(`/permissions/${permissionId}`),
  getRolePermissions: async (roleId: string) => {
    const { data } = await userApi.get<AdminPermission[]>(
      `/roles/${roleId}/permissions`,
    );
    return data;
  },
  getRoleMenus: async (roleId: string) => {
    const { data } = await userApi.get<Array<{ id: string }>>(
      `/roles/${roleId}/menus`,
    );
    return data;
  },
  updateRoleMenusAndPermissions: (
    roleId: string,
    data: { menuIds: string[]; permissionIds: string[] },
  ) => userApi.put(`/roles/${roleId}/menus-and-permissions`, data),
  listUserSystemRoles: async (userId: string) => {
    const { data } = await userApi.get<AdminSystemRoleGroup[]>(
      `/users/${userId}/roles`,
    );
    return data;
  },
  updateUserSystemRoles: (userId: string, data: AdminUserSystemRolesInput) =>
    userApi.put(`/users/${userId}/roles`, data),
  createUser: (data: AdminUserFormInput) => userApi.post('/users', data),
  updateUser: (userId: string, data: Partial<AdminUserFormInput>) =>
    userApi.patch(`/users/${userId}`, data),
  listUsers: async ({ page, pageSize = 10, username, includeDeleted }: AdminUserListParams) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (username) params.set('username', username);
    if (includeDeleted) params.set('includeDeleted', 'true');
    const { data } = await userApi.get(`/users?${params}`);
    return toUserListResponse(data);
  },
  deleteUser: (userId: string) => userApi.delete(`/users/${userId}`),
  updateUserStatus: (userId: string, status: string) =>
    userApi.patch(`/users/${userId}/status`, { status }),
  switchSystem: (systemId: string) => userApi.put('/auth/switch-system', { systemId }),
  sendPasswordReset: (email: string) => userApi.post('/auth/forgot-password', { email }),
  getPendingRegistrationCount: async () => {
    const { data } = await userApi.get<{ count: number }>('/registrations/pending-count');
    return data;
  },
  getDashboardStats: async (): Promise<AdminDashboardStats> => {
    const [users, roles, permissions, systems, menus] = await Promise.all([
      userApi.get<PaginatedCountResponse>('/users').then((res) => readPaginatedTotal(res.data)),
      userApi.get<CountListResponse>('/roles').then((res) => readListCount(res.data)),
      userApi.get<CountListResponse>('/permissions').then((res) => readListCount(res.data)),
      userApi.get<CountListResponse>('/systems').then((res) => readListCount(res.data)),
      userApi.get<CountListResponse>('/menus').then((res) => readListCount(res.data)),
    ]);

    return { users, roles, permissions, systems, menus };
  },
  listRecentUsers: async () => {
    const { data } = await userApi.get<{
      list?: AdminRecentUser[];
      data?: AdminRecentUser[];
    }>('/users?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc');
    return data.data ?? data.list ?? [];
  },
  changePassword: (data: AdminPasswordChangeInput) =>
    userApi.post('/auth/change-password', {
      oldPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
  listRegistrations: async (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    const { data } = await userApi.get<AdminRegistration[]>(
      `/registrations?status=${status}`,
    );
    return data;
  },
  approveRegistration: (id: string, note?: string) =>
    userApi.put(`/registrations/${id}/approve`, { note }),
  rejectRegistration: (id: string, note?: string) =>
    userApi.put(`/registrations/${id}/reject`, { note }),
  logoutRemote: () => userApi.post('/auth/logout'),
  sendResetPasswordEmail: (email: string) =>
    userApi.post('/auth/forgot-password', { email }),
};
