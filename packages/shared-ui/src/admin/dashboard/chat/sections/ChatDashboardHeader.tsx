'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, ClipboardList, Images, WalletCards } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Skeleton } from '../../../../ui/skeleton';
import { formatNumber, formatRate } from '../chat-dashboard.helpers';
import { CurrencyAmount } from '../CurrencyAmount';
import type {
  ChatDashboardHeaderMetrics,
  ChatDashboardValidation,
  DashboardSectionQuery,
} from '../chat-dashboard.types';

function MetricCard({
  label,
  icon: Icon,
  loading,
  error,
  invalid,
  zero,
  emptyLabel,
  onRetry,
  children,
}: {
  label: string;
  icon: typeof ClipboardList;
  loading: boolean;
  error: boolean;
  invalid?: boolean;
  zero?: boolean;
  emptyLabel?: string;
  onRetry: () => unknown;
  children: React.ReactNode;
}) {
  const t = useTranslations('chatDashboard.common');
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      {invalid ? (
        <p className="text-muted-foreground mt-5 text-sm">{t('selectValidRange')}</p>
      ) : loading ? (
        <Skeleton className="mt-5 h-9 w-28" />
      ) : error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant="destructive">{t('error')}</Badge>
          <span className="text-2xl">—</span>
          <Button variant="ghost" size="sm" onClick={() => void onRetry()}>{t('retry')}</Button>
        </div>
      ) : (
        <>
          <div className={`${zero ? 'text-muted-foreground' : 'text-foreground'} mt-5 text-3xl font-semibold`}>{children}</div>
          {zero && emptyLabel ? <p className="text-muted-foreground mt-2 text-xs">{emptyLabel}</p> : null}
        </>
      )}
    </div>
  );
}

export function ChatDashboardHeader({
  metrics,
  pending,
  generation,
  billing,
  content,
  validation,
}: {
  metrics: ChatDashboardHeaderMetrics;
  pending: DashboardSectionQuery<unknown>;
  generation: DashboardSectionQuery<unknown>;
  billing: DashboardSectionQuery<unknown>;
  content: DashboardSectionQuery<unknown>;
  validation: ChatDashboardValidation;
}) {
  const t = useTranslations('chatDashboard.header');
  const common = useTranslations('chatDashboard.common');
  const locale = useLocale();
  const invalid = !validation.ok;
  const gmv = metrics.billingGmvByCurrency;
  const gmvIsZero = Boolean(
    gmv?.length && gmv.every((item) => Number(item.amount) === 0),
  );
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label={t('pending')} icon={ClipboardList} loading={pending.isLoading} error={pending.isError} zero={metrics.pendingTotal === 0} emptyLabel={common('empty')} onRetry={pending.refetch}>
        {metrics.pendingTotal === undefined ? '—' : formatNumber(metrics.pendingTotal, locale)}
      </MetricCard>
      <MetricCard label={t('successRate')} icon={CheckCircle2} loading={generation.isLoading} error={generation.isError} invalid={invalid} onRetry={generation.refetch}>
        {formatRate(metrics.generationSuccessRate ?? null, locale)}
      </MetricCard>
      <MetricCard label={t('gmv')} icon={WalletCards} loading={billing.isLoading} error={billing.isError} invalid={invalid} zero={gmvIsZero} emptyLabel={common('empty')} onRetry={billing.refetch}>
        <span className="space-y-1 text-lg">{gmv?.length ? gmv.map((item) => <span key={item.currency} className="block"><CurrencyAmount amount={item.amount} currency={item.currency} locale={locale} unknownCurrencyTooltip={common('unknownCurrency')} /></span>) : <span className="text-muted-foreground text-sm font-normal">{common('empty')}</span>}</span>
      </MetricCard>
      <MetricCard label={t('published')} icon={Images} loading={content.isLoading} error={content.isError} invalid={invalid} zero={metrics.contentPublishedTotal === 0} emptyLabel={common('empty')} onRetry={content.refetch}>
        {metrics.contentPublishedTotal === undefined ? '—' : formatNumber(metrics.contentPublishedTotal, locale)}
      </MetricCard>
    </div>
  );
}
