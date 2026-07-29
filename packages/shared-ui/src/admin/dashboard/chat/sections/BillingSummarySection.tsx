'use client';

import { useLocale, useTranslations } from 'next-intl';
import { WalletCards } from 'lucide-react';
import type { ChatDashboardBillingSummary } from '@autix/domain/admin/chat-dashboard';
import { formatDeltaPct, formatNumber } from '../chat-dashboard.helpers';
import { CurrencyAmount } from '../CurrencyAmount';
import type { ChatDashboardValidation, DashboardSectionQuery } from '../chat-dashboard.types';
import { DashboardSectionShell, SectionSkeleton } from './SectionSkeleton';
import { SectionErrorState } from './SectionErrorState';

export function BillingSummarySection({ query, validation }: { query: DashboardSectionQuery<ChatDashboardBillingSummary>; validation: ChatDashboardValidation }) {
  const t = useTranslations('chatDashboard.billing');
  const common = useTranslations('chatDashboard.common');
  const locale = useLocale();
  if (!validation.ok) return <DashboardSectionShell title={t('title')} icon={WalletCards}><p className="text-muted-foreground text-sm">{common('selectValidRange')}</p></DashboardSectionShell>;
  if (query.isLoading) return <DashboardSectionShell title={t('title')} icon={WalletCards}><SectionSkeleton /></DashboardSectionShell>;
  if (query.isError || !query.data) return <DashboardSectionShell title={t('title')} icon={WalletCards}><SectionErrorState onRetry={query.refetch} /></DashboardSectionShell>;
  const data = query.data;
  return (
    <DashboardSectionShell title={t('title')} description={!data.range.isComplete ? common('estimate') : undefined} icon={WalletCards}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AmountMetric label={t('gmv')} rows={data.gmv} locale={locale} empty={common('empty')} unknownCurrencyTooltip={common('unknownCurrency')} />
        <AmountMetric label={t('refunded')} rows={data.refunded} locale={locale} empty={common('empty')} unknownCurrencyTooltip={common('unknownCurrency')} />
        <Metric label={t('paidOrders')} value={formatNumber(data.paidOrdersCount, locale)} zero={data.paidOrdersCount === 0} empty={common('empty')} />
        <Metric label={t('pendingOrders')} value={formatNumber(data.pendingOrdersCount, locale)} zero={data.pendingOrdersCount === 0} empty={common('empty')} />
        <Metric label={t('pointsConsumed')} value={formatNumber(data.pointsConsumed, locale)} zero={data.pointsConsumed === 0} empty={common('empty')} />
        <Metric label={t('activeHolds')} value={formatNumber(data.activeHoldsCount, locale)} zero={data.activeHoldsCount === 0} empty={common('empty')} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div><h3 className="text-foreground text-sm font-medium">{t('topConsumers')}</h3><div className="mt-2 divide-y">{data.topPointsConsumers.length ? data.topPointsConsumers.map((item) => <div key={item.userId} className="flex justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground">{item.displayName}</span><span>{formatNumber(item.points, locale)}</span></div>) : <p className="text-muted-foreground py-3 text-sm">{common('empty')}</p>}</div></div>
        <div><h3 className="text-foreground text-sm font-medium">{t('comparison')}</h3><div className="text-muted-foreground mt-3 space-y-2 text-sm"><p>{t('paidDelta', { value: formatDeltaPct(data.compareToPrev.paidOrdersDeltaPct, locale, common('new')) })}</p><p>{t('pointsDelta', { value: formatDeltaPct(data.compareToPrev.pointsConsumedDeltaPct, locale, common('new')) })}</p>{data.compareToPrev.gmvDeltaPctByCurrency.map((item) => <p key={item.currency}>{item.currency}: {formatDeltaPct(item.deltaPct, locale, common('new'))}</p>)}</div></div>
      </div>
    </DashboardSectionShell>
  );
}

function Metric({ label, value, zero = false, empty }: { label: string; value: string; zero?: boolean; empty?: string }) { return <div className="border-border rounded-lg border p-4"><div className="text-muted-foreground text-xs">{label}</div><div className={`${zero ? 'text-muted-foreground' : 'text-foreground'} mt-2 text-xl font-semibold`}>{value}</div>{zero && empty ? <div className="text-muted-foreground mt-2 text-xs">{empty}</div> : null}</div>; }
function AmountMetric({ label, rows, locale, empty, unknownCurrencyTooltip }: { label: string; rows: Array<{ currency: string; amount: string }>; locale: string; empty: string; unknownCurrencyTooltip: string }) {
  const zero = rows.length > 0 && rows.every((item) => Number(item.amount) === 0);
  return <div className="border-border rounded-lg border p-4"><div className="text-muted-foreground text-xs">{label}</div><div className={`${zero || rows.length === 0 ? 'text-muted-foreground' : 'text-foreground'} mt-2 space-y-1 font-semibold`}>{rows.length ? rows.map((item) => <div key={item.currency}><CurrencyAmount amount={item.amount} currency={item.currency} locale={locale} unknownCurrencyTooltip={unknownCurrencyTooltip} /></div>) : empty}</div>{zero ? <div className="text-muted-foreground mt-2 text-xs">{empty}</div> : null}</div>;
}
