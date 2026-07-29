'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';
import type { ChatDashboardRiskSignals } from '@autix/domain/admin/chat-dashboard';
import { Badge } from '../../../../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/tooltip';
import { formatDeltaPct, formatEventTime, formatNumber } from '../chat-dashboard.helpers';
import type { ChatDashboardValidation, DashboardSectionQuery } from '../chat-dashboard.types';
import { DashboardSectionShell, SectionSkeleton } from './SectionSkeleton';
import { SectionErrorState } from './SectionErrorState';

export function RiskSignalsSection({ query, validation, tz }: { query: DashboardSectionQuery<ChatDashboardRiskSignals>; validation: ChatDashboardValidation; tz: string | null }) {
  const t = useTranslations('chatDashboard.risk');
  const common = useTranslations('chatDashboard.common');
  const locale = useLocale();
  if (!validation.ok) return <DashboardSectionShell title={t('title')} icon={ShieldAlert}><p className="text-muted-foreground text-sm">{common('selectValidRange')}</p></DashboardSectionShell>;
  if (query.isLoading) return <DashboardSectionShell title={t('title')} icon={ShieldAlert}><SectionSkeleton rows={4} /></DashboardSectionShell>;
  if (query.isError || !query.data) return <DashboardSectionShell title={t('title')} icon={ShieldAlert}><SectionErrorState onRetry={query.refetch} /></DashboardSectionShell>;
  const data = query.data;
  const maxTypeCount = Math.max(1, ...data.topEventTypes.map((item) => item.count));
  const maxBucketCount = Math.max(1, ...data.severityBuckets.map((item) => item.count));
  return (
    <DashboardSectionShell title={t('title')} description={t('scope')} icon={ShieldAlert}>
      {!data.range.isComplete ? <p className="text-muted-foreground mb-4 text-sm">{common('estimate')}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(['L0', 'L1', 'L2', 'L3'] as const).map((level) => { const count = data.levelDistribution[level]; return <div key={level} className={`rounded-lg border p-4 ${level === 'L3' ? 'border-red-400/40' : level === 'L2' ? 'border-orange-400/40' : level === 'L1' ? 'border-blue-400/40' : 'border-border'}`}><div className="text-muted-foreground text-xs">{level}</div><div className={`${count === 0 ? 'text-muted-foreground' : 'text-foreground'} mt-2 text-2xl font-semibold`}>{formatNumber(count, locale)}</div>{count === 0 ? <div className="text-muted-foreground mt-2 text-xs">{common('empty')}</div> : null}</div>; })}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Tooltip><TooltipTrigger asChild><div tabIndex={0} className="border-border rounded-lg border p-4"><div className="text-muted-foreground text-xs">{t('evaluatedHighRisk')}</div><div className={`${data.evaluatedHighRiskUsersCount === 0 ? 'text-muted-foreground' : 'text-foreground'} mt-2 text-2xl font-semibold`}>{formatNumber(data.evaluatedHighRiskUsersCount, locale)}</div><div className="text-muted-foreground mt-2 text-xs">{t('evaluatedDelta', { value: formatDeltaPct(data.compareToPrev.evaluatedHighRiskUsersDeltaPct, locale, common('new')) })}</div>{data.evaluatedHighRiskUsersCount === 0 ? <div className="text-muted-foreground mt-2 text-xs">{common('empty')}</div> : null}</div></TooltipTrigger><TooltipContent className="max-w-sm">{t('evaluatedTooltip')}</TooltipContent></Tooltip>
        <div className="border-border rounded-lg border p-4"><div className="text-muted-foreground text-xs">{t('events')}</div><div className={`${data.eventCount === 0 ? 'text-muted-foreground' : 'text-foreground'} mt-2 text-2xl font-semibold`}>{formatNumber(data.eventCount, locale)}</div><div className="text-muted-foreground mt-2 text-xs">{t('eventDelta', { value: formatDeltaPct(data.compareToPrev.eventCountDeltaPct, locale, common('new')) })}</div>{data.eventCount === 0 ? <div className="text-muted-foreground mt-2 text-xs">{common('empty')}</div> : null}</div>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div><h3 className="text-sm font-medium">{t('topTypes')}</h3><div className="mt-2 divide-y">{data.topEventTypes.length ? data.topEventTypes.map((item) => <Tooltip key={item.type}><TooltipTrigger asChild><div tabIndex={0} className="cursor-default py-2 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">{item.type}</span><span>{formatNumber(item.count, locale)} · {item.avgSeverity === null ? '—' : formatNumber(Math.round(item.avgSeverity), locale)}</span></div><div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"><div data-testid={`risk-type-bar-${item.type}`} className="bg-primary h-full rounded-full" style={{ width: `${(item.count / maxTypeCount) * 100}%` }} /></div></div></TooltipTrigger><TooltipContent>{t('typeUnavailable')}</TooltipContent></Tooltip>) : <p className="text-muted-foreground py-3 text-sm">{common('empty')}</p>}</div></div>
        <div><h3 className="text-sm font-medium">{t('severity')}</h3><div className="mt-3 grid grid-cols-5 gap-2">{data.severityBuckets.map((item) => <div key={item.bucket} className="border-border rounded-md border p-2 text-center"><div className="flex h-14 items-end"><div data-testid={`risk-bucket-bar-${item.bucket}`} className="bg-primary/35 w-full rounded-sm" style={{ height: `${(item.count / maxBucketCount) * 100}%` }} /></div><div className="mt-2 text-xs font-medium">{t(`buckets.${item.bucket}`)}</div><div className={`${item.count === 0 ? 'text-muted-foreground' : 'text-foreground'} mt-1 text-lg font-semibold`}>{formatNumber(item.count, locale)}</div></div>)}</div></div>
      </div>
      <h3 className="mt-5 text-sm font-medium">{t('recent')}</h3>
      <div className="mt-2 divide-y">{data.recentHighSeverityEvents.length ? data.recentHighSeverityEvents.map((item) => <Tooltip key={item.id}><TooltipTrigger asChild><div tabIndex={0} className="flex cursor-default flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><span className="font-medium">{item.displayName}</span><span className="text-muted-foreground ml-2">{item.type}</span></div><div className="flex items-center gap-3"><time className="text-muted-foreground text-xs">{tz ? formatEventTime(item.createdAt, locale, tz) : item.createdAt}</time><Badge variant="destructive">{item.severity}</Badge></div></div></TooltipTrigger><TooltipContent>{t('userUnavailable')}</TooltipContent></Tooltip>) : <p className="text-muted-foreground py-4 text-sm">{t('noRecent')}</p>}</div>
    </DashboardSectionShell>
  );
}
