import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSyncBlockedState } from '../ProfileSyncBlockedState';

const state = vi.hoisted(() => ({
  retryProfileSync: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => ({
    syncingTitle: 'Refreshing profile',
    syncingDescription: 'Synchronizing access',
    brokenTitle: 'Profile synchronization failed',
    brokenDescription: 'Retry or reload',
    retry: 'Retry profile sync',
    reload: 'Reload page',
  }[key] ?? key),
}));

vi.mock('@autix/shared-store', () => ({
  authActions: { retryProfileSync: state.retryProfileSync },
}));

vi.mock('../../../navigation', () => ({
  useRouter: () => ({ refresh: state.refresh }),
}));

describe('ProfileSyncBlockedState', () => {
  beforeEach(() => {
    state.retryProfileSync.mockReset();
    state.refresh.mockReset();
  });

  afterEach(() => cleanup());

  it('renders a non-interactive syncing state', () => {
    render(<ProfileSyncBlockedState status="syncing" />);

    expect(screen.getByText('Refreshing profile')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('retries only the profile request and exposes a full reload action', async () => {
    let resolveRetry!: () => void;
    state.retryProfileSync.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveRetry = resolve;
      }),
    );
    render(<ProfileSyncBlockedState status="broken" />);

    const retry = screen.getByRole('button', { name: 'Retry profile sync' });
    const reload = screen.getByRole('button', { name: 'Reload page' });
    fireEvent.click(retry);
    expect(state.retryProfileSync).toHaveBeenCalledOnce();
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    expect((reload as HTMLButtonElement).disabled).toBe(true);

    resolveRetry();
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(reload);
    expect(state.refresh).toHaveBeenCalledOnce();
  });
});
