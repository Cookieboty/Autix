import type { AdminUserListItem } from '@autix/shared-store';

export function groupUserRolesBySystem(user: AdminUserListItem) {
  return Object.values(
    (user.roles ?? []).reduce<
      Record<
        string,
        {
          system: { id: string; name: string };
          roles: { id: string; name: string }[];
        }
      >
    >((acc, userRole) => {
      const sysId = userRole.role.system.id;
      if (!acc[sysId]) {
        acc[sysId] = { system: userRole.role.system, roles: [] };
      }
      acc[sysId].roles.push(userRole.role);
      return acc;
    }, {}),
  );
}
