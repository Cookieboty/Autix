import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../page';

const state = vi.hoisted(() => ({
  auth: { hydrated: false, profileSyncStatus: 'ready', systemCode: undefined as string | undefined },
  push: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@autix/shared-store', () => ({
  selectCurrentSystemCode: (value: typeof state.auth) => value.systemCode,
  useAuthStore: (selector: (value: typeof state.auth) => unknown) => selector(state.auth),
}));
vi.mock('@autix/shared-ui/ui', () => ({ RouteLoader: () => <div>route-loader</div> }));
vi.mock('@autix/shared-ui/admin', () => ({
  ProfileSyncBlockedState: ({ status }: { status: string }) => <div>blocked:{status}</div>,
  UnsupportedSystemState: ({ systemCode }: { systemCode?: string }) => <div>unsupported:{systemCode ?? 'none'}</div>,
  ChatAdminDashboardView: ({ onNavigate }: { onNavigate: (path: string) => void }) => <button onClick={() => onNavigate('/admin/gallery')}>chat-dashboard</button>,
  AdminSystemDashboardView: ({ onNavigate }: { onNavigate: (path: string) => void }) => <button onClick={() => onNavigate('/admin/users')}>admin-dashboard</button>,
}));

describe('DashboardPage dispatch', () => {
  beforeEach(() => {
    state.auth = { hydrated: false, profileSyncStatus: 'ready', systemCode: undefined };
    state.push.mockClear();
  });

  it('shows the route loader until auth hydration completes', () => {
    render(<DashboardPage />);
    expect(screen.getByText('route-loader')).toBeInTheDocument();
  });

  it.each(['syncing', 'broken'] as const)('blocks dispatch while profile status is %s', (profileSyncStatus) => {
    state.auth = { hydrated: true, profileSyncStatus, systemCode: 'chat' };
    render(<DashboardPage />);
    expect(screen.getByText(`blocked:${profileSyncStatus}`)).toBeInTheDocument();
  });

  it('dispatches chat and injects Web navigation', () => {
    state.auth = { hydrated: true, profileSyncStatus: 'ready', systemCode: 'chat' };
    render(<DashboardPage />);
    fireEvent.click(screen.getByText('chat-dashboard'));
    expect(state.push).toHaveBeenCalledWith('/admin/gallery');
  });

  it('dispatches admin-system and injects Web navigation', () => {
    state.auth = { hydrated: true, profileSyncStatus: 'ready', systemCode: 'admin-system' };
    render(<DashboardPage />);
    fireEvent.click(screen.getByText('admin-dashboard'));
    expect(state.push).toHaveBeenCalledWith('/admin/users');
  });

  it('shows an explicit unsupported state for unknown systems', () => {
    state.auth = { hydrated: true, profileSyncStatus: 'ready', systemCode: 'legacy-system' };
    render(<DashboardPage />);
    expect(screen.getByText('unsupported:legacy-system')).toBeInTheDocument();
  });
});
