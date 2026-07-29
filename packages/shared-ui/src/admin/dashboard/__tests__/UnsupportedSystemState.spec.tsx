import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedSystemState } from '../UnsupportedSystemState';

const state = vi.hoisted(() => ({
  auth: { systems: [] as Array<{ id: string; code: string; name: string }> },
  mutation: {
    isPending: false,
    variables: undefined as string | undefined,
    mutate: vi.fn(),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'description') return `Unsupported system: ${values?.code}`;
    if (key === 'switchTo') return `Switch to ${values?.name}`;
    return {
      title: 'No dashboard available',
      unknownCode: 'unknown',
      noKnownSystem: 'No known system is available',
    }[key] ?? key;
  },
}));

vi.mock('@autix/shared-store', () => ({
  useAuthStore: (selector: (value: typeof state.auth) => unknown) => selector(state.auth),
  useSwitchAdminSystemMutation: () => state.mutation,
}));

describe('UnsupportedSystemState', () => {
  beforeEach(() => {
    state.auth = { systems: [] };
    state.mutation = {
      isPending: false,
      variables: undefined,
      mutate: vi.fn(),
    };
  });

  afterEach(() => cleanup());

  it('shows the unknown code and only offers systems with implemented dashboards', () => {
    state.auth.systems = [
      { id: 'chat-id', code: 'chat', name: 'Chat' },
      { id: 'admin-id', code: 'admin-system', name: 'Admin' },
      { id: 'legacy-id', code: 'legacy', name: 'Legacy' },
    ];
    render(<UnsupportedSystemState systemCode="legacy" />);

    expect(screen.getByText('Unsupported system: legacy')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Switch to Chat' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Switch to Admin' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Switch to Legacy' })).toBeNull();
  });

  it('switches through the server mutation and disables all choices while pending', () => {
    state.auth.systems = [
      { id: 'chat-id', code: 'chat', name: 'Chat' },
      { id: 'admin-id', code: 'admin-system', name: 'Admin' },
    ];
    const { rerender } = render(<UnsupportedSystemState systemCode="legacy" />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Chat' }));
    expect(state.mutation.mutate).toHaveBeenCalledWith('chat-id');

    state.mutation.isPending = true;
    state.mutation.variables = 'chat-id';
    rerender(<UnsupportedSystemState systemCode="legacy" />);
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('renders a non-navigating empty state when the account owns no known system', () => {
    state.auth.systems = [{ id: 'legacy-id', code: 'legacy', name: 'Legacy' }];
    render(<UnsupportedSystemState />);

    expect(screen.getByText('Unsupported system: unknown')).not.toBeNull();
    expect(screen.getByText('No known system is available')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
