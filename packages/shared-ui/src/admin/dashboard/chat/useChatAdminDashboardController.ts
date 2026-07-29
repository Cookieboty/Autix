'use client';

import { useEffect, useState } from 'react';
import {
  selectCurrentSystemCode,
  useAuthStore,
  useChatDashboardBillingSummaryQuery,
  useChatDashboardContentPulseQuery,
  useChatDashboardGenerationHealthQuery,
  useChatDashboardPendingInboxQuery,
  useChatDashboardRiskSignalsQuery,
} from '@autix/shared-store';
import { deriveHeaderMetrics, toRangeQuery, validateRange } from './chat-dashboard.helpers';
import { useChatDashboardRangeParam } from './useChatDashboardRangeParam';

export function useChatAdminDashboardController() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const profileSyncStatus = useAuthStore((state) => state.profileSyncStatus);
  const systemCode = useAuthStore(selectCurrentSystemCode);
  const [tz, setTz] = useState<string | null>(null);
  const rangeParam = useChatDashboardRangeParam();

  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
  }, []);

  const validation = validateRange(rangeParam.range, tz);
  const query = validation.ok && tz ? toRangeQuery(rangeParam.range, tz) : null;
  const enabled = hydrated && profileSyncStatus === 'ready' && systemCode === 'chat';
  const pending = useChatDashboardPendingInboxQuery({ enabled });
  const generation = useChatDashboardGenerationHealthQuery(query, { enabled });
  const billing = useChatDashboardBillingSummaryQuery(query, { enabled });
  const content = useChatDashboardContentPulseQuery(query, { enabled });
  const risk = useChatDashboardRiskSignalsQuery(query, { enabled });
  const header = deriveHeaderMetrics({
    pending: pending.data,
    generation: generation.data,
    billing: billing.data,
    content: content.data,
  });

  return {
    tz,
    range: rangeParam.range,
    setPreset: rangeParam.setPreset,
    setCustom: rangeParam.setCustom,
    validation,
    header,
    pending,
    generation,
    billing,
    content,
    risk,
  };
}
