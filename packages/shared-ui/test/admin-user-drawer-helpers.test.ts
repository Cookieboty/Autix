import { describe, expect, test } from 'bun:test';
import {
  buildAddRoleSystemRoles,
  buildRemoveRoleSystemRoles,
  getApiErrorMessage,
  type UserSystemRoleGroup,
} from '../src/admin/users/user-drawer-helpers';

const groups: UserSystemRoleGroup[] = [
  {
    systemId: 'system-a',
    systemName: 'System A',
    roles: [
      { id: 'role-admin', name: 'Admin' },
      { id: 'role-user', name: 'User' },
    ],
  },
  {
    systemId: 'system-b',
    systemName: 'System B',
    roles: [{ id: 'role-viewer', name: 'Viewer' }],
  },
];

describe('admin user drawer helpers', () => {
  test('adds roles without duplicating existing assignments', () => {
    expect(buildAddRoleSystemRoles(groups, 'system-a', 'role-admin')).toEqual([
      { systemId: 'system-a', roleIds: ['role-admin', 'role-user'] },
      { systemId: 'system-b', roleIds: ['role-viewer'] },
    ]);

    expect(buildAddRoleSystemRoles(groups, 'system-a', 'role-auditor')).toEqual([
      { systemId: 'system-a', roleIds: ['role-admin', 'role-user', 'role-auditor'] },
      { systemId: 'system-b', roleIds: ['role-viewer'] },
    ]);
  });

  test('adds a new system role group when needed', () => {
    expect(buildAddRoleSystemRoles(groups, 'system-c', 'role-owner')).toEqual([
      { systemId: 'system-a', roleIds: ['role-admin', 'role-user'] },
      { systemId: 'system-b', roleIds: ['role-viewer'] },
      { systemId: 'system-c', roleIds: ['role-owner'] },
    ]);
  });

  test('removes roles and drops empty system groups', () => {
    expect(buildRemoveRoleSystemRoles(groups, 'system-b', 'role-viewer')).toEqual([
      { systemId: 'system-a', roleIds: ['role-admin', 'role-user'] },
    ]);

    expect(buildRemoveRoleSystemRoles(groups, 'system-a', 'role-user')).toEqual([
      { systemId: 'system-a', roleIds: ['role-admin'] },
      { systemId: 'system-b', roleIds: ['role-viewer'] },
    ]);
  });

  test('extracts API error messages with fallback', () => {
    expect(
      getApiErrorMessage(
        { response: { data: { message: 'Role already exists' } } },
        'fallback',
      ),
    ).toBe('Role already exists');
    expect(getApiErrorMessage(new Error('Network failed'), 'fallback')).toBe('Network failed');
    expect(getApiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
