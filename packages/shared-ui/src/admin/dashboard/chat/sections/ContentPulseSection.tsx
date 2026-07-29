'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Images } from 'lucide-react';
import type { ChatDashboardContentPulse } from '@autix/domain/admin/chat-dashboard';
import { formatDeltaPct, formatNumber } from '../chat-dashboard.helpers';
import type { ChatDashboardValidation, DashboardSectionQuery } from '../chat-dashboard.types';
import { DashboardSectionShell, SectionSkeleton } from './SectionSkeleton';
import { SectionErrorState } from './SectionErrorState';

export function ContentPulseSection({ query, validation }: { query: DashboardSectionQuery<ChatDashboardContentPulse>; validation: ChatDashboardValidation }) {
  const t = useTranslations('chatDashboard.content');
  const common = useTranslations('chatDashboard.common');
  const locale = useLocale();
  if (!validation.ok) return <DashboardSectionShell title={t('title')} icon={Images}><p className="text-muted-foreground text-sm">{common('selectValidRange')}</p></DashboardSectionShell>;
  if (query.isLoading) return <DashboardSectionShell title={t('title')} icon={Images}><SectionSkeleton /></DashboardSectionShell>;
  if (query.isError || !query.data) return <DashboardSectionShell title={t('title')} icon={Images}><SectionErrorState onRetry={query.refetch} /></DashboardSectionShell>;
  const data = query.data;
  return (
    <DashboardSectionShell title={t('title')} description={!data.range.isComplete ? common('estimate') : undefined} icon={Images}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={t('published')} value={formatNumber(data.galleryPublished.total, locale)} detail={t('publishedBreakdown', { image: data.galleryPublished.image, video: data.galleryPublished.video })} zero={data.galleryPublished.total === 0} empty={common('empty')} />
        <Metric label={t('featuredSlots')} value={`${formatNumber(data.featuredSlotsCoverage.activeResourceSlots, locale)} / ${formatNumber(data.featuredSlotsCoverage.enabledResourceSlots, locale)}`} zero={data.featuredSlotsCoverage.activeResourceSlots === 0 && data.featuredSlotsCoverage.enabledResourceSlots === 0} empty={common('empty')} />
        <Metric label={t('activeBoosts')} value={formatNumber(data.activeBoosts, locale)} zero={data.activeBoosts === 0} empty={common('empty')} />
        <Metric label={t('conversations')} value={formatNumber(data.conversationsCreated, locale)} zero={data.conversationsCreated === 0} empty={common('empty')} />
        <Metric label={t('comparison')} value={formatDeltaPct(data.compareToPrev.galleryPublishedDeltaPct, locale, common('new'))} detail={t('conversationDelta', { value: formatDeltaPct(data.compareToPrev.conversationsCreatedDeltaPct, locale, common('new')) })} />
      </div>
      <h3 className="text-foreground mt-5 text-sm font-medium">{t('hotTop')}</h3>
      <div className="mt-2 divide-y">{data.galleryHotTop10.length ? data.galleryHotTop10.map((item) => <div key={item.id} className="flex justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground truncate">{item.title || item.id}</span><span>{item.kind} · {formatNumber(item.hotScore, locale)}</span></div>) : <p className="text-muted-foreground py-3 text-sm">{common('empty')}</p>}</div>
    </DashboardSectionShell>
  );
}

function Metric({ label, value, detail, zero = false, empty }: { label: string; value: string; detail?: string; zero?: boolean; empty?: string }) { return <div className="border-border rounded-lg border p-4"><div className="text-muted-foreground text-xs">{label}</div><div className={`${zero ? 'text-muted-foreground' : 'text-foreground'} mt-2 text-xl font-semibold`}>{value}</div>{detail ? <div className="text-muted-foreground mt-2 text-xs">{detail}</div> : null}{zero && empty ? <div className="text-muted-foreground mt-2 text-xs">{empty}</div> : null}</div>; }
