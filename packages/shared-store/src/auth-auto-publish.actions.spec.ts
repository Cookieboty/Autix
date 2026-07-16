import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateAutoPublish = vi.fn();
const mockSetUser = vi.fn();

vi.mock('@autix/sdk', () => ({
  userApi: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
  storageApi: {},
  uploadToPresignedUrl: vi.fn(),
  updateMyAutoPublish: mockUpdateAutoPublish,
}));

vi.mock('@autix/platform', () => ({
  getAuth: () => ({ setUser: mockSetUser }),
  getNavigation: vi.fn(),
}));

describe('authActions.updateAutoPublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('patches server, persists user, and updates only user.autoPublish', async () => {
    const { authActions, useAuthStore } = await import('./auth.store');
    mockUpdateAutoPublish.mockResolvedValueOnce({ data: { autoPublish: true } });

    // Seed store with a fully-populated session (menus/systems/features must survive).
    useAuthStore.setState({
      user: { id: 'u1', autoPublish: false } as never,
      isAuthenticated: true,
      menus: [{ id: 'm1' }] as never,
      systems: [{ id: 's1' }] as never,
      features: { accountDeletion: true },
    });

    await authActions.updateAutoPublish(true);

    expect(mockUpdateAutoPublish).toHaveBeenCalledWith(true);
    const state = useAuthStore.getState();
    expect(state.user?.autoPublish).toBe(true);
    // P1c: collections untouched.
    expect(state.menus).toEqual([{ id: 'm1' }]);
    expect(state.systems).toEqual([{ id: 's1' }]);
    expect(state.features).toEqual({ accountDeletion: true });
    // Persisted the merged user to the local adapter.
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', autoPublish: true }),
    );
  });

  it('no-ops the store write when there is no current user', async () => {
    const { authActions, useAuthStore } = await import('./auth.store');
    mockUpdateAutoPublish.mockResolvedValueOnce({ data: { autoPublish: true } });
    useAuthStore.setState({ user: null, isAuthenticated: false });

    await authActions.updateAutoPublish(true);

    expect(mockUpdateAutoPublish).toHaveBeenCalledWith(true);
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockSetUser).not.toHaveBeenCalled();
  });
});
