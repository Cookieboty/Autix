export interface UserSystemRoleGroup {
  systemId: string;
  systemName: string;
  roles: Array<{
    id: string;
    name: string;
  }>;
}

export function buildAddRoleSystemRoles(
  groups: UserSystemRoleGroup[],
  selectedSystemId: string,
  selectedRoleId: string,
) {
  const systemRoles = groups.map((group) => ({
    systemId: group.systemId,
    roleIds: group.roles.map((roleItem) => roleItem.id),
  }));
  const targetGroup = systemRoles.find((group) => group.systemId === selectedSystemId);

  if (targetGroup) {
    if (!targetGroup.roleIds.includes(selectedRoleId)) {
      targetGroup.roleIds.push(selectedRoleId);
    }
  } else {
    systemRoles.push({ systemId: selectedSystemId, roleIds: [selectedRoleId] });
  }

  return systemRoles;
}

export function buildRemoveRoleSystemRoles(
  groups: UserSystemRoleGroup[],
  systemId: string,
  roleId: string,
) {
  return groups
    .map((group) => ({
      systemId: group.systemId,
      roleIds: group.roles
        .map((roleItem) => roleItem.id)
        .filter((id) => !(group.systemId === systemId && id === roleId)),
    }))
    .filter((group) => group.roleIds.length > 0);
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })
    .response?.data?.message;
  if (typeof responseMessage === 'string') return responseMessage;

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}
