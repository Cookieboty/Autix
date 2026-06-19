import { userApi } from '@autix/sdk';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING';
}

export interface AdminSystem {
  id: string;
  name: string;
  code: string;
  status?: string;
}

export interface AdminRole {
  id: string;
  name: string;
  code: string;
  description?: string;
  sort?: number;
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
  children: AdminMenu[];
  permissions: AdminPermission[];
}

export interface AdminPermissionSystem {
  id: string;
  name: string;
  code: string;
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

const toRoleList = (data: AdminRole[] | { list?: AdminRole[] }): AdminRole[] => {
  if (Array.isArray(data)) return data;
  return data.list ?? [];
};

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
  createRole: (data: AdminRoleFormInput) => userApi.post('/roles', data),
  updateRole: (roleId: string, data: AdminRoleFormInput) =>
    userApi.patch(`/roles/${roleId}`, data),
  getPermissionTree: async () => {
    const { data } = await userApi.get<AdminPermissionSystem[]>('/permission-tree');
    return data;
  },
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
};
