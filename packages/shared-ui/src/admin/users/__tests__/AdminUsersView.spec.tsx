import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersView } from '../users-view';

const state = vi.hoisted(() => ({
  navigation: {
    pathname: '/admin/users',
    search: '',
    replace: vi.fn(),
  },
  auth: {
    profileSyncStatus: 'ready',
    user: {
      id: 'admin-1',
      isSuperAdmin: true,
      currentSystemId: 'admin-system-id' as string | undefined,
    },
    systems: [] as Array<{ id: string; code: string; name: string }>,
    hasPermission: vi.fn(() => false),
  },
  switchMutation: {
    mutateAsync: vi.fn(),
  },
  usersQuery: vi.fn(() => ({
    data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../../../navigation', () => ({
  usePathname: () => state.navigation.pathname,
  useRouter: () => ({ replace: state.navigation.replace }),
  useSearchParams: () => new URLSearchParams(state.navigation.search),
}));

vi.mock('@autix/shared-store', () => ({
  useAuthStore: (selector?: (value: typeof state.auth) => unknown) =>
    selector ? selector(state.auth) : state.auth,
  useSwitchAdminSystemMutation: () => state.switchMutation,
  useAdminUsersQuery: state.usersQuery,
  usePendingRegistrationCountQuery: () => ({ data: { count: 2 } }),
  useDeleteAdminUserMutation: () => ({ mutate: vi.fn() }),
  useUpdateAdminUserStatusMutation: () => ({ mutate: vi.fn() }),
  useSendAdminPasswordResetMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../../ui', () => ({
  Button: ({ variant: _variant, size: _size, asChild: _asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean }) => <button {...props} />,
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Checkbox: () => <input type="checkbox" />,
  Select: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../index', () => ({
  RegistrationApproval: () => <div>registration-approval</div>,
  UserDrawer: () => null,
}));

vi.mock('../UsersTable', () => ({
  UsersTable: () => <div>users-table</div>,
}));

vi.mock('../../../shells', () => ({
  AdminDialogShell: () => null,
  AdminDialogHero: () => null,
  AdminDialogFooterRow: () => null,
}));

vi.mock('../../dashboard/ProfileSyncBlockedState', () => ({
  ProfileSyncBlockedState: ({ status }: { status: string }) => <div>blocked:{status}</div>,
}));

describe('AdminUsersView URL and system workflow', () => {
  beforeEach(() => {
    state.navigation.search = '';
    state.navigation.replace.mockReset();
    state.auth.profileSyncStatus = 'ready';
    state.auth.user = {
      id: 'admin-1',
      isSuperAdmin: true,
      currentSystemId: 'admin-system-id',
    };
    state.auth.systems = [];
    state.auth.hasPermission.mockReturnValue(false);
    state.switchMutation.mutateAsync.mockReset();
    state.switchMutation.mutateAsync.mockResolvedValue(undefined);
    state.usersQuery.mockClear();
  });

  afterEach(() => cleanup());

  it('opens registration approval from ?tab=pending and preserves other params when switching tabs', () => {
    state.navigation.search = 'tab=pending&source=inbox';
    render(<AdminUsersView />);

    expect(screen.getByText('registration-approval')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'allUsers' }));
    expect(state.navigation.replace).toHaveBeenCalledWith(
      '/admin/users?tab=all&source=inbox',
    );
  });

  it('writes the pending tab to the URL from the all-users view', () => {
    state.navigation.search = 'tab=all&source=toolbar';
    render(<AdminUsersView />);

    expect(screen.getByText('users-table')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /pendingApproval/ }));
    expect(state.navigation.replace).toHaveBeenCalledWith(
      '/admin/users?tab=pending&source=toolbar',
    );
  });

  it('restores the active tab from an external search-param change without a replace loop', async () => {
    state.navigation.search = 'tab=all&source=history';
    const { rerender } = render(<AdminUsersView />);
    expect(screen.getByText('users-table')).not.toBeNull();

    state.navigation.search = 'tab=pending&source=history';
    rerender(<AdminUsersView />);

    await waitFor(() => {
      expect(screen.getByText('registration-approval')).not.toBeNull();
    });
    expect(state.navigation.replace).not.toHaveBeenCalled();
  });

  it('uses only the server-backed switch mutation when one system must be selected', async () => {
    state.auth.user = {
      id: 'admin-1',
      isSuperAdmin: false,
      currentSystemId: undefined,
    };
    state.auth.systems = [{ id: 'chat-id', code: 'chat', name: 'Chat' }];
    render(<AdminUsersView />);

    await waitFor(() => {
      expect(state.switchMutation.mutateAsync).toHaveBeenCalledWith('chat-id');
    });
  });

  it('blocks user queries while profile synchronization is broken', () => {
    state.auth.profileSyncStatus = 'broken';
    render(<AdminUsersView />);

    expect(screen.getByText('blocked:broken')).not.toBeNull();
    expect(state.usersQuery).not.toHaveBeenCalled();
  });

  it('also blocks user queries while profile synchronization is in progress', () => {
    state.auth.profileSyncStatus = 'syncing';
    render(<AdminUsersView />);

    expect(screen.getByText('blocked:syncing')).not.toBeNull();
    expect(state.usersQuery).not.toHaveBeenCalled();
  });
});
