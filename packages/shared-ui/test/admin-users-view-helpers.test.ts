import { describe, expect, test } from 'bun:test';
import type { AdminUserListItem } from '@autix/shared-store';
import { groupUserRolesBySystem } from '../src/admin/users/users-view-helpers';

function user(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    status: 'ACTIVE',
    roles: [
      {
        role: {
          id: 'role-admin',
          name: 'Admin',
          system: { id: 'system-a', name: 'System A' },
        },
      },
      {
        role: {
          id: 'role-user',
          name: 'User',
          system: { id: 'system-a', name: 'System A' },
        },
      },
      {
        role: {
          id: 'role-viewer',
          name: 'Viewer',
          system: { id: 'system-b', name: 'System B' },
        },
      },
    ],
    ...overrides,
  } as AdminUserListItem;
}

describe('admin users view helpers', () => {
  test('groups user roles by owning system while preserving role order', () => {
    expect(groupUserRolesBySystem(user())).toEqual([
      {
        system: { id: 'system-a', name: 'System A' },
        roles: [
          { id: 'role-admin', name: 'Admin', system: { id: 'system-a', name: 'System A' } },
          { id: 'role-user', name: 'User', system: { id: 'system-a', name: 'System A' } },
        ],
      },
      {
        system: { id: 'system-b', name: 'System B' },
        roles: [{ id: 'role-viewer', name: 'Viewer', system: { id: 'system-b', name: 'System B' } }],
      },
    ]);
  });

  test('returns an empty list when the user has no roles', () => {
    expect(groupUserRolesBySystem(user({ roles: [] }))).toEqual([]);
    expect(groupUserRolesBySystem(user({ roles: undefined } as Partial<AdminUserListItem>))).toEqual([]);
  });
});
