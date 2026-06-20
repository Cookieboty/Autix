import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  adminIdentityActions,
  type AdminMenuFormInput,
  type AdminPermissionFormInput,
  type AdminRegistration,
  type AdminRoleFormInput,
  type AdminSystemFormInput,
  type AdminUserFormInput,
  type AdminUserListParams,
  type AdminUserSystemRolesInput,
} from './admin-identity.actions';

type MutationCallbacks = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

type RegistrationStatus = AdminRegistration['status'];

export const adminIdentityQueryKeys = {
  systems: () => ['adminIdentity', 'systems'] as const,
  roles: () => ['adminIdentity', 'roles'] as const,
  rolesBySystem: (systemId: string) =>
    ['adminIdentity', 'roles', 'system', systemId] as const,
  rolePermissions: (roleId: string) =>
    ['adminIdentity', 'roles', roleId, 'permissions'] as const,
  roleMenus: (roleId: string) =>
    ['adminIdentity', 'roles', roleId, 'menus'] as const,
  dashboardStats: () => ['adminIdentity', 'dashboard', 'stats'] as const,
  recentUsers: () => ['adminIdentity', 'dashboard', 'recent-users'] as const,
  users: (params: AdminUserListParams) =>
    ['adminIdentity', 'users', params.page, params.pageSize ?? 10, params.username ?? ''] as const,
  usersRoot: () => ['adminIdentity', 'users'] as const,
  userSystemRoles: (userId: string) =>
    ['adminIdentity', 'users', userId, 'roles'] as const,
  permissionTree: () => ['adminIdentity', 'permission-tree'] as const,
  registrations: (status: RegistrationStatus) =>
    ['adminIdentity', 'registrations', status] as const,
  registrationsRoot: () => ['adminIdentity', 'registrations'] as const,
  pendingRegistrationCount: () => ['adminIdentity', 'registrations', 'pending-count'] as const,
};

function callOnSuccess(callbacks?: MutationCallbacks) {
  return callbacks?.onSuccess?.();
}

function callOnError(error: unknown, callbacks?: MutationCallbacks) {
  return callbacks?.onError?.(error);
}

function invalidateSystems(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: adminIdentityQueryKeys.systems() });
}

function invalidateRoles(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: adminIdentityQueryKeys.roles() });
}

function invalidateUsers(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: adminIdentityQueryKeys.usersRoot() });
}

function invalidatePermissionTree(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: adminIdentityQueryKeys.permissionTree() });
}

function invalidateRegistrations(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminIdentityQueryKeys.registrationsRoot() }),
    queryClient.invalidateQueries({ queryKey: adminIdentityQueryKeys.pendingRegistrationCount() }),
    invalidateUsers(queryClient),
  ]);
}

export function useAdminSystemsQuery(enabled = true) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.systems(),
    queryFn: adminIdentityActions.listSystems,
    enabled,
  });
}

export function useAdminRolesQuery() {
  return useQuery({
    queryKey: adminIdentityQueryKeys.roles(),
    queryFn: adminIdentityActions.listRoles,
  });
}

export function useAdminRolesBySystemQuery(systemId: string, enabled = true) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.rolesBySystem(systemId),
    queryFn: () => adminIdentityActions.listRolesBySystem(systemId),
    enabled: enabled && Boolean(systemId),
  });
}

export function useAdminRolePermissionsQuery(roleId: string, enabled = true) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.rolePermissions(roleId),
    queryFn: () => adminIdentityActions.getRolePermissions(roleId),
    enabled: enabled && Boolean(roleId),
  });
}

export function useAdminRoleMenusQuery(roleId: string, enabled = true) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.roleMenus(roleId),
    queryFn: () => adminIdentityActions.getRoleMenus(roleId),
    enabled: enabled && Boolean(roleId),
  });
}

export function useCreateAdminRoleMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminRoleFormInput) => adminIdentityActions.createRole(data),
    onSuccess: async () => {
      await invalidateRoles(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminRoleMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminRoleFormInput }) =>
      adminIdentityActions.updateRole(id, data),
    onSuccess: async () => {
      await invalidateRoles(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminRoleMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminIdentityActions.deleteRole,
    onSuccess: async () => {
      await invalidateRoles(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminRoleMenusAndPermissionsMutation(
  callbacks?: MutationCallbacks,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      menuIds,
      permissionIds,
    }: {
      roleId: string;
      menuIds: string[];
      permissionIds: string[];
    }) =>
      adminIdentityActions.updateRoleMenusAndPermissions(roleId, {
        menuIds,
        permissionIds,
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidateRoles(queryClient),
        invalidatePermissionTree(queryClient),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminUsersQuery(params: AdminUserListParams) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.users(params),
    queryFn: () => adminIdentityActions.listUsers(params),
  });
}

export function useAdminUserSystemRolesQuery(userId: string, enabled = true) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.userSystemRoles(userId),
    queryFn: () => adminIdentityActions.listUserSystemRoles(userId),
    enabled: enabled && Boolean(userId),
  });
}

export function useAdminDashboardStatsQuery() {
  return useQuery({
    queryKey: adminIdentityQueryKeys.dashboardStats(),
    queryFn: adminIdentityActions.getDashboardStats,
  });
}

export function useAdminRecentUsersQuery() {
  return useQuery({
    queryKey: adminIdentityQueryKeys.recentUsers(),
    queryFn: adminIdentityActions.listRecentUsers,
  });
}

export function usePendingRegistrationCountQuery() {
  return useQuery({
    queryKey: adminIdentityQueryKeys.pendingRegistrationCount(),
    queryFn: adminIdentityActions.getPendingRegistrationCount,
  });
}

export function useCreateAdminUserMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminUserFormInput) => adminIdentityActions.createUser(data),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminUserMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminUserFormInput> }) =>
      adminIdentityActions.updateUser(id, data),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminUserMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminIdentityActions.deleteUser,
    onSuccess: async () => {
      await invalidateUsers(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminUserStatusMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminIdentityActions.updateUserStatus(id, status),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminUserSystemRolesMutation(
  callbacks?: MutationCallbacks,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserSystemRolesInput }) =>
      adminIdentityActions.updateUserSystemRoles(id, data),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateUsers(queryClient),
        queryClient.invalidateQueries({
          queryKey: adminIdentityQueryKeys.userSystemRoles(variables.id),
        }),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useSwitchAdminSystemMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminIdentityActions.switchSystem,
    onSuccess: async () => {
      await invalidateUsers(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useSendAdminPasswordResetMutation(callbacks?: MutationCallbacks) {
  return useMutation({
    mutationFn: adminIdentityActions.sendPasswordReset,
    onSuccess: () => callOnSuccess(callbacks),
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useChangeAdminPasswordMutation(callbacks?: MutationCallbacks) {
  return useMutation({
    mutationFn: adminIdentityActions.changePassword,
    onSuccess: () => callOnSuccess(callbacks),
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminPermissionTreeQuery(enabled = true) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.permissionTree(),
    queryFn: adminIdentityActions.getPermissionTree,
    enabled,
  });
}

export function useCreateAdminSystemMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminSystemFormInput) => adminIdentityActions.createSystem(data),
    onSuccess: async () => {
      await Promise.all([
        invalidateSystems(queryClient),
        invalidatePermissionTree(queryClient),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminSystemMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminSystemFormInput }) =>
      adminIdentityActions.updateSystem(id, data),
    onSuccess: async () => {
      await Promise.all([
        invalidateSystems(queryClient),
        invalidatePermissionTree(queryClient),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminSystemMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminIdentityActions.deleteSystem,
    onSuccess: async () => {
      await Promise.all([
        invalidateSystems(queryClient),
        invalidatePermissionTree(queryClient),
      ]);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useCreateAdminMenuMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminMenuFormInput) => adminIdentityActions.createMenu(data),
    onSuccess: async () => {
      await invalidatePermissionTree(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminMenuMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminMenuFormInput }) =>
      adminIdentityActions.updateMenu(id, data),
    onSuccess: async () => {
      await invalidatePermissionTree(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminMenuMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminIdentityActions.deleteMenu,
    onSuccess: async () => {
      await invalidatePermissionTree(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useCreateAdminPermissionMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminPermissionFormInput) =>
      adminIdentityActions.createPermission(data),
    onSuccess: async () => {
      await invalidatePermissionTree(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useUpdateAdminPermissionMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminPermissionFormInput }) =>
      adminIdentityActions.updatePermission(id, data),
    onSuccess: async () => {
      await invalidatePermissionTree(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useDeleteAdminPermissionMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminIdentityActions.deletePermission,
    onSuccess: async () => {
      await invalidatePermissionTree(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminRegistrationsQuery(
  status: RegistrationStatus,
  enabled = true,
) {
  return useQuery({
    queryKey: adminIdentityQueryKeys.registrations(status),
    queryFn: () => adminIdentityActions.listRegistrations(status),
    enabled,
  });
}

export function useApproveAdminRegistrationMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminIdentityActions.approveRegistration(id, note),
    onSuccess: async () => {
      await invalidateRegistrations(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useRejectAdminRegistrationMutation(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminIdentityActions.rejectRegistration(id, note),
    onSuccess: async () => {
      await invalidateRegistrations(queryClient);
      await callOnSuccess(callbacks);
    },
    onError: (error) => callOnError(error, callbacks),
  });
}

export function useAdminRolesController() {
  const queryClient = useQueryClient();
  return {
    invalidateRoles: () => invalidateRoles(queryClient),
  };
}

export function useAdminUsersController() {
  const queryClient = useQueryClient();
  return {
    invalidateUsers: () => invalidateUsers(queryClient),
  };
}

export function useAdminPermissionTreeController() {
  const queryClient = useQueryClient();
  return {
    invalidatePermissionTree: () => invalidatePermissionTree(queryClient),
  };
}

export function useAdminLogoutController() {
  const logoutRemoteMutation = useMutation({
    mutationFn: adminIdentityActions.logoutRemote,
  });

  return {
    logoutRemote: logoutRemoteMutation.mutateAsync,
    isLoggingOut: logoutRemoteMutation.isPending,
  };
}
