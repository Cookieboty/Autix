import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider, type UseMutationResult } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  switchSystem: vi.fn(),
  refreshProfile: vi.fn(),
  setProfileSyncStatus: vi.fn(),
}));

vi.mock('./admin-identity.actions', () => ({
  adminIdentityActions: { switchSystem: mocks.switchSystem },
}));
vi.mock('./auth.store', () => ({
  authActions: {
    refreshProfile: mocks.refreshProfile,
    setProfileSyncStatus: mocks.setProfileSyncStatus,
  },
}));
vi.mock('./chat-admin-dashboard.queries', () => ({
  chatAdminDashboardKeys: { all: ['chat-admin-dashboard'] },
}));

describe('useSwitchAdminSystemMutation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let mutation: UseMutationResult<void, Error, string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.switchSystem.mockResolvedValue(undefined);
    mocks.refreshProfile.mockResolvedValue(undefined);
    mocks.setProfileSyncStatus.mockResolvedValue(undefined);
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const { useSwitchAdminSystemMutation } = await import('./admin-identity.queries');
    function Probe() {
      mutation = useSwitchAdminSystemMutation() as UseMutationResult<void, Error, string>;
      return null;
    }
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
  });

  it('runs PUT → refresh → ready and invalidates both root keys only on success', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    await act(async () => { await mutation.mutateAsync('chat-id'); });
    expect(mocks.setProfileSyncStatus.mock.calls).toEqual([['syncing'], ['ready']]);
    expect(mocks.switchSystem).toHaveBeenCalledWith('chat-id');
    expect(mocks.refreshProfile).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['adminIdentity'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chat-admin-dashboard'] });
  });

  it('restores ready and skips refresh when PUT fails', async () => {
    const original = new Error('put failed');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    mocks.switchSystem.mockRejectedValueOnce(original);
    await expect(act(async () => { await mutation.mutateAsync('chat-id'); })).rejects.toBe(original);
    expect(mocks.setProfileSyncStatus.mock.calls).toEqual([['syncing'], ['ready']]);
    expect(mocks.refreshProfile).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('enters broken and throws the dedicated error when profile refresh fails', async () => {
    const original = new Error('profile failed');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    mocks.refreshProfile.mockRejectedValueOnce(original);
    const rejected = act(async () => { await mutation.mutateAsync('chat-id'); });
    await expect(rejected).rejects.toMatchObject({
      code: 'ADMIN_SYSTEM_PROFILE_SYNC',
      cause: original,
    });
    expect(mocks.setProfileSyncStatus.mock.calls).toEqual([['syncing'], ['broken']]);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
