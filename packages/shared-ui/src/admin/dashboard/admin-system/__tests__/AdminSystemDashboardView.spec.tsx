import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSystemDashboardView } from '../AdminSystemDashboardView';

const state = vi.hoisted(() => ({
  auth: {
    user: { username: 'ada', realName: 'Ada Lovelace' },
  },
  stats: {
    data: { users: 1234, roles: 12, permissions: 34, systems: 2, menus: 56 },
    isLoading: false,
  },
  recent: {
    data: [{ username: 'grace', realName: 'Grace Hopper', createdAt: '2026-07-28T12:00:00.000Z' }],
    isLoading: false,
  },
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'de-DE',
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'greetingWithName') return `${values?.greeting}, ${values?.name}`;
    return key;
  },
}));

vi.mock('@autix/shared-store', () => ({
  useAuthStore: (selector: (value: typeof state.auth) => unknown) => selector(state.auth),
  useAdminDashboardStatsQuery: () => state.stats,
  useAdminRecentUsersQuery: () => state.recent,
}));

describe('AdminSystemDashboardView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T09:15:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows only real identity metrics, recent users, and four governance actions', () => {
    const onNavigate = vi.fn();
    render(<AdminSystemDashboardView onNavigate={onNavigate} />);

    for (const metric of ['totalUsers', 'roleCount', 'permissionCount', 'systemCount', 'menuCount']) {
      expect(screen.getByText(metric)).not.toBeNull();
    }
    for (const action of ['addUser', 'addRole', 'permConfig', 'auditLogsAction']) {
      expect(screen.getByText(action)).not.toBeNull();
    }
    expect(screen.getByText('Grace Hopper')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /addUser/ }));
    fireEvent.click(screen.getByRole('button', { name: /addRole/ }));
    fireEvent.click(screen.getByRole('button', { name: /permConfig/ }));
    fireEvent.click(screen.getByRole('button', { name: /auditLogsAction/ }));
    expect(onNavigate.mock.calls.map(([path]) => path)).toEqual([
      '/admin/users',
      '/admin/roles',
      '/admin/permission-center',
      '/admin/audit-logs',
    ]);
  });

  it('formats values with the active locale and contains no fabricated platform status', () => {
    const { container } = render(<AdminSystemDashboardView onNavigate={vi.fn()} />);
    const expectedDate = new Date(state.recent.data[0].createdAt).toLocaleDateString('de-DE');

    expect(screen.getByText('1.234')).not.toBeNull();
    expect(screen.getByText(expectedDate)).not.toBeNull();
    expect(container.textContent).toContain('Ada Lovelace');
    for (const forbidden of ['settings', 'models', 'campaigns', 'uptime', 'version', '+12%', 'v2.0.0']) {
      expect(container.textContent?.toLowerCase()).not.toContain(forbidden);
    }
  });
});
