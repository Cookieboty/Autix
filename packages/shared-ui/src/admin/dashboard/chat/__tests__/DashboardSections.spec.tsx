import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ChatDashboardBillingSummary,
  ChatDashboardContentPulse,
  ChatDashboardGenerationHealth,
  ChatDashboardPendingInbox,
} from '@autix/domain/admin/chat-dashboard';
import { ChatDashboardHeader } from '../sections/ChatDashboardHeader';
import { BillingSummarySection } from '../sections/BillingSummarySection';
import { ChatQuickActionsSection } from '../sections/ChatQuickActionsSection';
import { ContentPulseSection } from '../sections/ContentPulseSection';
import { GenerationHealthSection } from '../sections/GenerationHealthSection';
import { PendingInboxSection } from '../sections/PendingInboxSection';

const messages: Record<string, string> = {
  'chatDashboard.common.empty': 'No data in this period',
  'chatDashboard.common.error': 'Error',
  'chatDashboard.common.estimate': 'The current period is provisional.',
  'chatDashboard.common.new': 'New',
  'chatDashboard.common.retry': 'Retry',
  'chatDashboard.common.selectValidRange': 'Choose a valid time range.',
  'chatDashboard.common.unknownCurrency': 'Legacy orders without a currency are grouped under UNKNOWN.',
  'chatDashboard.header.pending': 'Pending work',
  'chatDashboard.header.successRate': 'Generation success rate',
  'chatDashboard.header.gmv': 'GMV',
  'chatDashboard.header.published': 'Gallery published',
  'chatDashboard.generation.title': 'Generation Health',
  'chatDashboard.generation.byKind': 'By generation type',
  'chatDashboard.generation.kinds.IMAGE': 'Images',
  'chatDashboard.generation.kinds.VIDEO': 'Videos',
  'chatDashboard.generation.kindFailureRate': 'Failure rate {value}',
  'chatDashboard.generation.successRate': 'Success rate',
  'chatDashboard.generation.failureRate': 'Failure rate',
  'chatDashboard.generation.avgDuration': 'Average duration',
  'chatDashboard.generation.milliseconds': '{value} ms',
  'chatDashboard.generation.failureReasons': 'Top failure reasons',
  'chatDashboard.generation.topModels': 'Top models',
  'chatDashboard.generation.comparison': 'Volume {total}; success rate {success}',
  'chatDashboard.generation.totals.total': 'Total',
  'chatDashboard.generation.totals.active': 'Active',
  'chatDashboard.generation.totals.succeeded': 'Succeeded',
  'chatDashboard.generation.totals.failed': 'Failed',
  'chatDashboard.generation.totals.expired': 'Expired',
  'chatDashboard.pending.title': 'Pending Inbox',
  'chatDashboard.pending.description': 'Operational queues',
  'chatDashboard.pending.gallery.label': 'Gallery reviews',
  'chatDashboard.pending.reports.label': 'Gallery reports',
  'chatDashboard.pending.reports.unavailable': 'Reports unavailable',
  'chatDashboard.pending.templates.label': 'Template reviews',
  'chatDashboard.pending.templates.breakdown': 'Image {image} · Video {video}',
  'chatDashboard.pending.registrations.label': 'Registration approvals',
  'chatDashboard.pending.risk.label': 'Flagged risk users',
  'chatDashboard.pending.batch.label': 'Running batch jobs',
  'chatDashboard.pending.batch.unavailable': 'Batch jobs unavailable',
  'chatDashboard.billing.title': 'Billing Summary',
  'chatDashboard.billing.gmv': 'GMV',
  'chatDashboard.billing.refunded': 'Refunded',
  'chatDashboard.billing.paidOrders': 'Paid orders',
  'chatDashboard.billing.pendingOrders': 'Pending orders',
  'chatDashboard.billing.pointsConsumed': 'Points consumed',
  'chatDashboard.billing.activeHolds': 'Active holds',
  'chatDashboard.billing.topConsumers': 'Top consumers',
  'chatDashboard.billing.comparison': 'Comparison',
  'chatDashboard.billing.paidDelta': 'Paid {value}',
  'chatDashboard.billing.pointsDelta': 'Points {value}',
  'chatDashboard.content.title': 'Content Pulse',
  'chatDashboard.content.published': 'Published',
  'chatDashboard.content.publishedBreakdown': 'Image {image} · Video {video}',
  'chatDashboard.content.featuredSlots': 'Active / enabled slots',
  'chatDashboard.content.activeBoosts': 'Active boosts',
  'chatDashboard.content.conversations': 'Conversations',
  'chatDashboard.content.comparison': 'Published change',
  'chatDashboard.content.conversationDelta': 'Conversations {value}',
  'chatDashboard.content.hotTop': 'Hot gallery posts',
  'chatDashboard.quickActions.title': 'Quick Actions',
  'chatDashboard.quickActions.templates': 'Templates',
  'chatDashboard.quickActions.gallery': 'Gallery',
  'chatDashboard.quickActions.generationTasks': 'Generation tasks',
  'chatDashboard.quickActions.campaigns': 'Campaigns',
  'chatDashboard.quickActions.featuredSlots': 'Featured slots',
  'chatDashboard.quickActions.boosts': 'Boosts',
  'chatDashboard.quickActions.orders': 'Orders',
  'chatDashboard.quickActions.points': 'Points',
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
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const readyQuery = {
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

describe('Chat dashboard sections', () => {
  afterEach(() => cleanup());

  it('renders localized zero states and explains UNKNOWN currency in the Header', () => {
    render(
      <ChatDashboardHeader
        metrics={{
          pendingTotal: 0,
          generationSuccessRate: 0,
          billingGmvByCurrency: [{ currency: 'UNKNOWN', amount: '0.00' }],
          contentPublishedTotal: 0,
        }}
        pending={readyQuery}
        generation={readyQuery}
        billing={readyQuery}
        content={readyQuery}
        validation={{ ok: true }}
      />,
    );

    expect(screen.getAllByText('No data in this period').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('0.00 UNKNOWN')).not.toBeNull();
    expect(
      screen.getByText('Legacy orders without a currency are grouped under UNKNOWN.'),
    ).not.toBeNull();
  });

  it('uses an explicit error badge and retries only the failed Header card', () => {
    const refetch = vi.fn();
    render(
      <ChatDashboardHeader
        metrics={{}}
        pending={{ ...readyQuery, isError: true, refetch }}
        generation={readyQuery}
        billing={readyQuery}
        content={readyQuery}
        validation={{ ok: true }}
      />,
    );

    expect(screen.getByText('Error')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders the required generation by-kind breakdown', () => {
    const data: ChatDashboardGenerationHealth = {
      range: {
        window: 'today',
        tz: 'UTC',
        from: '2026-07-29T00:00:00.000Z',
        to: '2026-07-30T00:00:00.000Z',
        isComplete: true,
      },
      totals: { total: 12, active: 1, succeeded: 8, failed: 2, expired: 1 },
      successRate: 0.8,
      failureRate: 0.2,
      avgDurationMs: 1_250,
      byKind: [
        { kind: 'IMAGE', total: 10, failureRate: 0.1 },
        { kind: 'VIDEO', total: 2, failureRate: 0.5 },
      ],
      topFailureReasons: [],
      topModels: [],
      compareToPrev: { totalDeltaPct: 20, successRateDeltaPoints: 5 },
    };

    render(
      <GenerationHealthSection
        query={{ ...readyQuery, data }}
        validation={{ ok: true }}
      />,
    );

    expect(screen.getByText('By generation type')).not.toBeNull();
    expect(screen.getByText('Images')).not.toBeNull();
    expect(screen.getByText('Videos')).not.toBeNull();
    expect(screen.getByText('Failure rate 10%')).not.toBeNull();
    expect(screen.getByText('Failure rate 50%')).not.toBeNull();
  });

  it('keeps unavailable Pending cards non-interactive while navigating real targets', () => {
    const onNavigate = vi.fn();
    const data: ChatDashboardPendingInbox = {
      galleryPendingCount: 1,
      galleryPendingReportCount: 2,
      templatePendingCount: 7,
      templatePendingImageCount: 3,
      templatePendingVideoCount: 4,
      registrationPendingCount: 5,
      riskFlaggedUserCount: 6,
      batchJobProcessingCount: 8,
      updatedAt: '2026-07-29T12:00:00.000Z',
    };

    render(
      <PendingInboxSection
        query={{ ...readyQuery, data }}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Gallery reports/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Running batch jobs/ })).toBeNull();
    expect(screen.getByText('Reports unavailable')).not.toBeNull();
    expect(screen.getByText('Batch jobs unavailable')).not.toBeNull();
    expect(screen.getByText('Image 3 · Video 4')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Registration approvals/ }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/users?tab=pending');
  });

  it('renders all eight Quick Actions with only the three approved badges', () => {
    const onNavigate = vi.fn();
    const pending = {
      galleryPendingCount: 3,
      galleryPendingReportCount: 0,
      templatePendingCount: 2,
      templatePendingImageCount: 1,
      templatePendingVideoCount: 1,
      registrationPendingCount: 0,
      riskFlaggedUserCount: 0,
      batchJobProcessingCount: 0,
      updatedAt: '2026-07-29T12:00:00.000Z',
    } satisfies ChatDashboardPendingInbox;
    const billing = {
      pendingOrdersCount: 4,
    } as ChatDashboardBillingSummary;

    render(
      <ChatQuickActionsSection
        pending={pending}
        billing={billing}
        onNavigate={onNavigate}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(8);
    expect(screen.getByRole('button', { name: /Templates 2/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Gallery 3/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Orders 4/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Campaigns' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Boosts' }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/boosts');
  });

  it('keeps Billing zero values, UNKNOWN currency, and provisional comparison visible', () => {
    const data: ChatDashboardBillingSummary = {
      range: {
        window: 'today',
        tz: 'UTC',
        from: '2026-07-29T00:00:00.000Z',
        to: '2026-07-30T00:00:00.000Z',
        isComplete: false,
      },
      gmv: [{ currency: 'UNKNOWN', amount: '0.00' }],
      paidOrdersCount: 0,
      pendingOrdersCount: 0,
      refunded: [],
      pointsConsumed: 0,
      activeHoldsCount: 0,
      topPointsConsumers: [],
      compareToPrev: {
        gmvDeltaPctByCurrency: [{ currency: 'UNKNOWN', deltaPct: 0 }],
        paidOrdersDeltaPct: 0,
        pointsConsumedDeltaPct: 0,
      },
    };

    render(
      <BillingSummarySection
        query={{ ...readyQuery, data }}
        validation={{ ok: true }}
      />,
    );

    expect(screen.getByText('0.00 UNKNOWN')).not.toBeNull();
    expect(screen.getByText('Legacy orders without a currency are grouped under UNKNOWN.')).not.toBeNull();
    expect(screen.getByText('The current period is provisional.')).not.toBeNull();
    expect(screen.getAllByText('No data in this period').length).toBeGreaterThanOrEqual(5);
  });

  it('keeps Content snapshots separate from range deltas and marks incomplete ranges', () => {
    const data: ChatDashboardContentPulse = {
      range: {
        window: 'last7d',
        tz: 'UTC',
        from: '2026-07-23T00:00:00.000Z',
        to: '2026-07-30T00:00:00.000Z',
        isComplete: false,
      },
      galleryPublished: { total: 0, image: 0, video: 0 },
      galleryHotTop10: [{ id: 'post-1', title: 'Hot post', kind: 'IMAGE', hotScore: 12 }],
      featuredSlotsCoverage: { activeResourceSlots: 1, enabledResourceSlots: 2 },
      activeBoosts: 3,
      conversationsCreated: 0,
      compareToPrev: {
        galleryPublishedDeltaPct: 0,
        conversationsCreatedDeltaPct: null,
      },
    };

    render(
      <ContentPulseSection
        query={{ ...readyQuery, data }}
        validation={{ ok: true }}
      />,
    );

    expect(screen.getByText('The current period is provisional.')).not.toBeNull();
    expect(screen.getByText('1 / 2')).not.toBeNull();
    expect(screen.getByText('3')).not.toBeNull();
    expect(screen.getByText('Hot post')).not.toBeNull();
    expect(screen.getByText('Conversations New')).not.toBeNull();
  });
});
