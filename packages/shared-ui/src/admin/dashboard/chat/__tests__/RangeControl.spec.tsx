import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatDashboardRangeQuery } from '@autix/domain/admin/chat-dashboard';
import { RangeControl } from '../RangeControl';
import {
  addLocalDays,
  toRangeQuery,
  validateRange,
} from '../chat-dashboard.helpers';
import { useChatDashboardRangeParam } from '../useChatDashboardRangeParam';

const navigation = vi.hoisted(() => ({
  search: '',
  replace: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('../../../../navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const NOW = new Date('2026-07-29T12:00:00.000Z');

function RangeHarness({
  onQuery,
  tz = 'UTC',
}: {
  onQuery: (query: ChatDashboardRangeQuery) => void;
  tz?: string | null;
}) {
  const { range, setPreset, setCustom } = useChatDashboardRangeParam();
  const validation = validateRange(range, tz, NOW);
  const query = validation.ok && tz ? toRangeQuery(range, tz) : null;

  useEffect(() => {
    if (query) onQuery(query);
  }, [onQuery, query]);

  return (
    <RangeControl
      range={range}
      validation={validation}
      onPreset={setPreset}
      onCustom={setCustom}
    />
  );
}

describe('RangeControl', () => {
  beforeEach(() => {
    navigation.search = '';
    navigation.replace.mockReset();
  });

  afterEach(() => cleanup());

  it('reads the URL and replaces preset params while preserving unknown params', () => {
    navigation.search = 'window=custom&from=2026-07-01&to=2026-07-02&source=ops';
    render(<RangeHarness onQuery={vi.fn()} />);

    expect(screen.getByLabelText('from')).toHaveProperty('value', '2026-07-01');
    fireEvent.click(screen.getByRole('button', { name: 'today' }));

    expect(navigation.replace).toHaveBeenCalledWith('/admin?window=today&source=ops');
  });

  it('writes custom day values through the shared navigation adapter', () => {
    navigation.search = 'window=custom&from=2026-07-01&to=2026-07-02&source=ops';
    render(<RangeHarness onQuery={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('from'), {
      target: { value: '2026-07-03' },
    });

    expect(navigation.replace).toHaveBeenCalledWith(
      '/admin?window=custom&from=2026-07-03&to=2026-07-02&source=ops',
    );
  });

  it.each([
    ['missing date', 'window=custom&from=&to=2026-07-29'],
    ['nonexistent date', 'window=custom&from=2026-02-30&to=2026-03-01'],
    ['reversed dates', 'window=custom&from=2026-07-20&to=2026-07-19'],
    ['future date', 'window=custom&from=2026-07-30&to=2026-07-30'],
    ['93 days', 'window=custom&from=2026-04-28&to=2026-07-29'],
    [
      'over 400 days old',
      `window=custom&from=${addLocalDays('2026-07-29', -401)}&to=${addLocalDays('2026-07-29', -401)}`,
    ],
  ])('shows an inline error and does not query for %s', (_label, search) => {
    navigation.search = search;
    const onQuery = vi.fn();
    render(<RangeHarness onQuery={onQuery} />);

    expect(screen.getByText('invalidRange')).not.toBeNull();
    expect(screen.getByLabelText('from').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('to').getAttribute('aria-invalid')).toBe('true');
    expect(onQuery).not.toHaveBeenCalled();
  });

  it('accepts a single-day custom range and the exact 400-day boundary', () => {
    const onQuery = vi.fn();
    navigation.search = 'window=custom&from=2026-07-29&to=2026-07-29';
    const { unmount } = render(<RangeHarness onQuery={onQuery} />);
    expect(onQuery).toHaveBeenCalledWith({
      tz: 'UTC',
      window: 'custom',
      from: '2026-07-29',
      to: '2026-07-29',
    });

    unmount();
    onQuery.mockClear();
    const boundary = addLocalDays('2026-07-29', -400);
    navigation.search = `window=custom&from=${boundary}&to=${boundary}`;
    render(<RangeHarness onQuery={onQuery} />);
    expect(onQuery).toHaveBeenCalledOnce();
  });

  it('does not provide a timezone selector or silently fall back without a browser timezone', () => {
    const onQuery = vi.fn();
    navigation.search = 'window=today';
    render(<RangeHarness onQuery={onQuery} tz={null} />);

    expect(screen.getByText('invalidTimezone')).not.toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(onQuery).not.toHaveBeenCalled();
  });
});
