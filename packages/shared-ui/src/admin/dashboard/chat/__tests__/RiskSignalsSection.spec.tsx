import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatDashboardRiskSignals } from '@autix/domain/admin/chat-dashboard';
import { RiskSignalsSection } from '../sections/RiskSignalsSection';

const messages: Record<string, string> = {
  'chatDashboard.risk.title': 'Risk Signals',
  'chatDashboard.risk.scope': 'Platform-wide distribution excluding deleted users',
  'chatDashboard.risk.evaluatedHighRisk': 'Evaluated in this window and currently L2/L3',
  'chatDashboard.risk.evaluatedTooltip': 'This is not a count of newly promoted users or level transitions.',
  'chatDashboard.risk.evaluatedDelta': 'Evaluated users change {value}',
  'chatDashboard.risk.events': 'Risk events',
  'chatDashboard.risk.eventDelta': 'Event change {value}',
  'chatDashboard.risk.topTypes': 'Top event types',
  'chatDashboard.risk.typeUnavailable': 'Filtering by event type and time is not available yet.',
  'chatDashboard.risk.severity': 'Severity distribution',
  'chatDashboard.risk.buckets.A': 'A: 0',
  'chatDashboard.risk.buckets.B': 'B: 1–39',
  'chatDashboard.risk.buckets.C': 'C: 40–69',
  'chatDashboard.risk.buckets.D': 'D: 70–99',
  'chatDashboard.risk.buckets.E': 'E: 100',
  'chatDashboard.risk.recent': 'Recent high-severity events (≥70)',
  'chatDashboard.risk.userUnavailable': 'The risk user detail page is not available yet.',
  'chatDashboard.risk.noRecent': 'Manual override and clawback events use severity 0 and are excluded.',
  'chatDashboard.common.empty': 'Empty',
  'chatDashboard.common.error': 'Error',
  'chatDashboard.common.estimate': 'Current period is in progress; comparison is provisional.',
  'chatDashboard.common.new': 'New',
  'chatDashboard.common.retry': 'Retry',
  'chatDashboard.common.selectValidRange': 'Select a valid range',
};

vi.mock('next-intl', () => ({
  useLocale: () => 'en-US',
  useTranslations: (namespace?: string) => (
    key: string,
    values?: Record<string, string>,
  ) => {
    const message = messages[namespace ? `${namespace}.${key}` : key] ?? key;
    return Object.entries(values ?? {}).reduce(
      (result, [name, value]) => result.replace(`{${name}}`, value),
      message,
    );
  },
}));

vi.mock('../../../../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

const completeRange = {
  window: 'today',
  tz: 'UTC',
  from: '2026-07-29T00:00:00.000Z',
  to: '2026-07-30T00:00:00.000Z',
  isComplete: true,
} as const;

function createData(overrides: Partial<ChatDashboardRiskSignals> = {}): ChatDashboardRiskSignals {
  return {
    range: completeRange,
    levelDistribution: { L0: 0, L1: 0, L2: 0, L3: 0 },
    evaluatedHighRiskUsersCount: 0,
    eventCount: 0,
    topEventTypes: [],
    severityBuckets: [
      { bucket: 'A', count: 0 },
      { bucket: 'B', count: 0 },
      { bucket: 'C', count: 0 },
      { bucket: 'D', count: 0 },
      { bucket: 'E', count: 0 },
    ],
    recentHighSeverityEvents: [],
    compareToPrev: {
      eventCountDeltaPct: 0,
      evaluatedHighRiskUsersDeltaPct: 0,
    },
    ...overrides,
  };
}

const readyQuery = (data: ChatDashboardRiskSignals) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

describe('RiskSignalsSection', () => {
  afterEach(() => cleanup());

  it('renders loading and retry states independently', () => {
    const refetch = vi.fn();
    const { container, rerender } = render(
      <RiskSignalsSection
        query={{ isLoading: true, isError: false, refetch }}
        validation={{ ok: true }}
        tz="UTC"
      />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    rerender(
      <RiskSignalsSection
        query={{ isLoading: false, isError: true, refetch }}
        validation={{ ok: true }}
        tz="UTC"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByText('Error')).not.toBeNull();
  });

  it('keeps zero values, the full-platform scope, all levels, and A-E bucket order visible', () => {
    const { container } = render(
      <RiskSignalsSection query={readyQuery(createData())} validation={{ ok: true }} tz="UTC" />,
    );

    expect(screen.getByText('Platform-wide distribution excluding deleted users')).not.toBeNull();
    for (const level of ['L0', 'L1', 'L2', 'L3']) {
      expect(screen.getByText(level)).not.toBeNull();
    }
    const bucketLabels = Array.from(container.querySelectorAll('.grid-cols-5 .text-xs')).map(
      (node) => node.textContent,
    );
    expect(bucketLabels).toEqual(['A: 0', 'B: 1–39', 'C: 40–69', 'D: 70–99', 'E: 100']);
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(9);
    expect(screen.getByText(/severity 0/)).not.toBeNull();
  });

  it('uses the evaluated-not-promoted wording and keeps top/recent rows non-interactive', () => {
    render(
      <RiskSignalsSection
        query={readyQuery(createData({
          evaluatedHighRiskUsersCount: 2,
          topEventTypes: [{ type: 'AUTO_SCORE', count: 3, avgSeverity: 75 }],
          recentHighSeverityEvents: [{
            id: 'event-1',
            userId: 'user-1',
            displayName: 'Ada',
            type: 'AUTO_SCORE',
            severity: 80,
            createdAt: '2026-07-29T08:00:00.000Z',
          }],
        }))}
        validation={{ ok: true }}
        tz="UTC"
      />,
    );

    expect(screen.getByText('Evaluated in this window and currently L2/L3')).not.toBeNull();
    expect(screen.queryByText(/newly promoted/i)).not.toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    const tooltips = screen.getAllByTestId('tooltip-content');
    expect(within(tooltips[1]).getByText(/Filtering by event type/)).not.toBeNull();
    expect(within(tooltips[2]).getByText(/detail page/)).not.toBeNull();
    expect(screen.getByTestId('risk-type-bar-AUTO_SCORE').style.width).toBe('100%');
    expect(screen.getByTestId('risk-bucket-bar-A')).not.toBeNull();
  });

  it('marks an incomplete range comparison as provisional', () => {
    render(
      <RiskSignalsSection
        query={readyQuery(createData({ range: { ...completeRange, isComplete: false } }))}
        validation={{ ok: true }}
        tz="UTC"
      />,
    );
    expect(screen.getByText('Current period is in progress; comparison is provisional.')).not.toBeNull();
  });
});
