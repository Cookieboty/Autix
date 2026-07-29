'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Activity } from 'lucide-react';
import type { ChatDashboardGenerationHealth } from '@autix/domain/admin/chat-dashboard';
import { formatDeltaPct, formatDeltaPoints, formatNumber, formatRate } from '../chat-dashboard.helpers';
import type { ChatDashboardValidation, DashboardSectionQuery } from '../chat-dashboard.types';
import { DashboardSectionShell, SectionSkeleton } from './SectionSkeleton';
import { SectionErrorState } from './SectionErrorState';

export function GenerationHealthSection({ query, validation }: { query: DashboardSectionQuery<ChatDashboardGenerationHealth>; validation: ChatDashboardValidation }) {
  const t = useTranslations('chatDashboard.generation');
  const common = useTranslations('chatDashboard.common');
  const locale = useLocale();
  if (!validation.ok) return <DashboardSectionShell title={t('title')} icon={Activity}><p className="text-muted-foreground text-sm">{common('selectValidRange')}</p></DashboardSectionShell>;
  if (query.isLoading) return <DashboardSectionShell title={t('title')} icon={Activity}><SectionSkeleton /></DashboardSectionShell>;
  if (query.isError || !query.data) return <DashboardSectionShell title={t('title')} icon={Activity}><SectionErrorState onRetry={query.refetch} /></DashboardSectionShell>;
  const data = query.data;
  return (
    <DashboardSectionShell title={t('title')} description={!data.range.isComplete ? common('estimate') : undefined} icon={Activity}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(data.totals).map(([key, value]) => <Metric key={key} label={t(`totals.${key}`)} value={formatNumber(value, locale)} zero={value === 0} empty={common('empty')} />)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label={t('successRate')} value={formatRate(data.successRate, locale)} /><Metric label={t('failureRate')} value={formatRate(data.failureRate, locale)} /><Metric label={t('avgDuration')} value={data.avgDurationMs === null ? '—' : t('milliseconds', { value: formatNumber(Math.round(data.avgDurationMs), locale) })} /></div>
      <h3 className="text-foreground mt-5 text-sm font-medium">{t('byKind')}</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {data.byKind.map((item) => (
          <Metric
            key={item.kind}
            label={t(`kinds.${item.kind}`)}
            value={formatNumber(item.total, locale)}
            detail={t('kindFailureRate', { value: formatRate(item.failureRate, locale) })}
            zero={item.total === 0}
            empty={common('empty')}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <List title={t('failureReasons')} empty={common('empty')} rows={data.topFailureReasons.map((item) => ({ key: `${item.errorStage}-${item.errorClass}`, label: `${item.errorStage ?? '—'} / ${item.errorClass ?? '—'}`, value: formatNumber(item.count, locale) }))} />
        <List title={t('topModels')} empty={common('empty')} rows={data.topModels.map((item) => ({ key: `${item.provider}-${item.model}`, label: `${item.provider ?? '—'} / ${item.model}`, value: `${formatNumber(item.count, locale)} · ${formatRate(item.failureRate, locale)}` }))} />
      </div>
      <p className="text-muted-foreground mt-4 text-sm">{t('comparison', { total: formatDeltaPct(data.compareToPrev.totalDeltaPct, locale, common('new')), success: formatDeltaPoints(data.compareToPrev.successRateDeltaPoints, locale, common('new')) })}</p>
    </DashboardSectionShell>
  );
}

function Metric({ label, value, detail, zero = false, empty }: { label: string; value: string; detail?: string; zero?: boolean; empty?: string }) { return <div className="border-border rounded-lg border p-4"><div className="text-muted-foreground text-xs">{label}</div><div className={`${zero ? 'text-muted-foreground' : 'text-foreground'} mt-2 text-xl font-semibold`}>{value}</div>{detail ? <div className="text-muted-foreground mt-2 text-xs">{detail}</div> : null}{zero && empty ? <div className="text-muted-foreground mt-2 text-xs">{empty}</div> : null}</div>; }
function List({ title, rows, empty }: { title: string; rows: Array<{ key: string; label: string; value: string }>; empty: string }) { return <div><h3 className="text-foreground text-sm font-medium">{title}</h3><div className="mt-2 divide-y">{rows.length ? rows.map((row) => <div key={row.key} className="flex justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground truncate">{row.label}</span><span>{row.value}</span></div>) : <p className="text-muted-foreground py-4 text-sm">{empty}</p>}</div></div>; }
