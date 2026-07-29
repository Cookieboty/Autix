'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Gauge } from 'lucide-react';
import type { ChatDashboardBillingSummary, ChatDashboardPendingInbox } from '@autix/domain/admin/chat-dashboard';
import { Badge } from '../../../../ui/badge';
import { CHAT_QUICK_ACTIONS, formatNumber } from '../chat-dashboard.helpers';
import { DashboardSectionShell } from './SectionSkeleton';

export function ChatQuickActionsSection({ pending, billing, onNavigate }: { pending?: ChatDashboardPendingInbox; billing?: ChatDashboardBillingSummary; onNavigate: (path: string) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const badges = {
    templatePendingCount: pending?.templatePendingCount,
    galleryPendingCount: pending?.galleryPendingCount,
    pendingOrdersCount: billing?.pendingOrdersCount,
  };
  return (
    <DashboardSectionShell title={t('chatDashboard.quickActions.title')} icon={Gauge}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHAT_QUICK_ACTIONS.map((action) => {
          const badge = action.badgeSource ? badges[action.badgeSource] : undefined;
          return <button key={action.menuCode} type="button" onClick={() => onNavigate(action.path)} className="border-border hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-4 text-left transition-colors"><div className="min-w-0 flex-1 font-medium">{t(action.i18nKey)}</div>{badge !== undefined && badge > 0 ? <Badge variant="destructive">{formatNumber(badge, locale)}</Badge> : null}<ArrowRight className="text-muted-foreground h-4 w-4" /></button>;
        })}
      </div>
    </DashboardSectionShell>
  );
}
