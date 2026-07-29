export type ChatDashboardPresetWindow = 'today' | 'yesterday' | 'last7d';

export type ChatDashboardWindow = ChatDashboardPresetWindow | 'custom';

/** Shared day-level range query used by the API, SDK, store, and UI. */
export type ChatDashboardRangeQuery =
  | { tz: string; window: ChatDashboardPresetWindow }
  | { tz: string; window: 'custom'; from: string; to: string };

/** Ratio in the inclusive 0..1 range. */
export type ChatDashboardRate = number;

/** Percentage delta. `null` means previous=0 and current>0 (a newly appearing value). */
export type ChatDashboardDeltaPct = number | null;

export interface ChatDashboardCurrencyDeltaPct {
  currency: string;
  deltaPct: ChatDashboardDeltaPct;
}

export interface ChatDashboardResolvedRange {
  window: ChatDashboardWindow;
  tz: string;
  from: string;
  to: string;
  fromDate?: string;
  toDate?: string;
  isComplete: boolean;
}

export interface ChatDashboardPendingInbox {
  galleryPendingCount: number;
  galleryPendingReportCount: number;
  templatePendingCount: number;
  templatePendingImageCount: number;
  templatePendingVideoCount: number;
  registrationPendingCount: number;
  riskFlaggedUserCount: number;
  batchJobProcessingCount: number;
  updatedAt: string;
}

export interface ChatDashboardGenerationHealth {
  range: ChatDashboardResolvedRange;
  totals: {
    total: number;
    active: number;
    succeeded: number;
    failed: number;
    expired: number;
  };
  successRate: ChatDashboardRate | null;
  failureRate: ChatDashboardRate | null;
  avgDurationMs: number | null;
  byKind: Array<{
    kind: 'IMAGE' | 'VIDEO';
    total: number;
    failureRate: ChatDashboardRate | null;
  }>;
  topFailureReasons: Array<{
    errorStage: string | null;
    errorClass: string | null;
    count: number;
  }>;
  topModels: Array<{
    provider: string | null;
    model: string;
    count: number;
    failureRate: ChatDashboardRate | null;
  }>;
  compareToPrev: {
    totalDeltaPct: ChatDashboardDeltaPct;
    successRateDeltaPoints: number | null;
  };
}

export interface ChatDashboardAmountByCurrency {
  currency: string;
  amount: string;
}

export interface ChatDashboardBillingSummary {
  range: ChatDashboardResolvedRange;
  gmv: ChatDashboardAmountByCurrency[];
  paidOrdersCount: number;
  pendingOrdersCount: number;
  refunded: ChatDashboardAmountByCurrency[];
  pointsConsumed: number;
  activeHoldsCount: number;
  topPointsConsumers: Array<{
    userId: string;
    displayName: string;
    points: number;
  }>;
  compareToPrev: {
    gmvDeltaPctByCurrency: ChatDashboardCurrencyDeltaPct[];
    paidOrdersDeltaPct: ChatDashboardDeltaPct;
    pointsConsumedDeltaPct: ChatDashboardDeltaPct;
  };
}

export interface ChatDashboardContentPulse {
  range: ChatDashboardResolvedRange;
  galleryPublished: { total: number; image: number; video: number };
  galleryHotTop10: Array<{
    id: string;
    title: string | null;
    kind: 'IMAGE' | 'VIDEO';
    hotScore: number;
  }>;
  featuredSlotsCoverage: {
    activeResourceSlots: number;
    enabledResourceSlots: number;
  };
  activeBoosts: number;
  conversationsCreated: number;
  compareToPrev: {
    galleryPublishedDeltaPct: ChatDashboardDeltaPct;
    conversationsCreatedDeltaPct: ChatDashboardDeltaPct;
  };
}

/**
 * Risk severity follows the current identity/risk 0..100 write model.
 * A=0, B=1..39, C=40..69, D=70..99, E=100.
 * `evaluatedHighRiskUsersCount` is not a level-transition count: it means the
 * user was evaluated in the window and is currently L2/L3. Recent high
 * severity events use severity >= 70; manual severity=0 events are excluded.
 */
export interface ChatDashboardRiskSignals {
  range: ChatDashboardResolvedRange;
  levelDistribution: {
    L0: number;
    L1: number;
    L2: number;
    L3: number;
  };
  evaluatedHighRiskUsersCount: number;
  eventCount: number;
  topEventTypes: Array<{
    type: string;
    count: number;
    avgSeverity: number | null;
  }>;
  severityBuckets: Array<{
    bucket: 'A' | 'B' | 'C' | 'D' | 'E';
    count: number;
  }>;
  recentHighSeverityEvents: Array<{
    id: string;
    userId: string;
    displayName: string;
    type: string;
    severity: number;
    createdAt: string;
  }>;
  compareToPrev: {
    eventCountDeltaPct: ChatDashboardDeltaPct;
    evaluatedHighRiskUsersDeltaPct: ChatDashboardDeltaPct;
  };
}
