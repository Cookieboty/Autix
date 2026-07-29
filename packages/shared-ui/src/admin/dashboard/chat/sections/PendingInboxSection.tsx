'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ClipboardList } from 'lucide-react';
import type { ChatDashboardPendingInbox } from '@autix/domain/admin/chat-dashboard';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/tooltip';
import { PENDING_INBOX_LINKS, formatNumber } from '../chat-dashboard.helpers';
import type { DashboardSectionQuery } from '../chat-dashboard.types';
import { DashboardSectionShell, SectionSkeleton } from './SectionSkeleton';
import { SectionErrorState } from './SectionErrorState';

export function PendingInboxSection({ query, onNavigate }: { query: DashboardSectionQuery<ChatDashboardPendingInbox>; onNavigate: (path: string) => void }) {
  const t = useTranslations('chatDashboard.pending');
  const common = useTranslations('chatDashboard.common');
  const locale = useLocale();
  if (query.isLoading) return <DashboardSectionShell title={t('title')} icon={ClipboardList}><SectionSkeleton rows={2} /></DashboardSectionShell>;
  if (query.isError || !query.data) return <DashboardSectionShell title={t('title')} icon={ClipboardList}><SectionErrorState onRetry={query.refetch} /></DashboardSectionShell>;
  const data = query.data;
  const counts = {
    gallery: data.galleryPendingCount,
    reports: data.galleryPendingReportCount,
    templates: data.templatePendingCount,
    registrations: data.registrationPendingCount,
    risk: data.riskFlaggedUserCount,
    batch: data.batchJobProcessingCount,
  };
  return (
    <DashboardSectionShell title={t('title')} description={t('description')} icon={ClipboardList}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PENDING_INBOX_LINKS.map((item) => {
          const count = counts[item.key];
          const content = (
            <div className={`rounded-lg border p-4 ${item.href && count > 0 ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors' : item.href ? 'border-border hover:bg-accent/40 transition-colors' : 'border-border'}`}>
              <div className="text-muted-foreground text-sm">{t(`${item.key}.label`)}</div>
              <div className={`${count === 0 ? 'text-muted-foreground' : 'text-foreground'} mt-3 text-3xl font-semibold`}>{formatNumber(count, locale)}</div>
              {count === 0 ? <div className="text-muted-foreground mt-2 text-xs">{common('empty')}</div> : null}
              {item.key === 'templates' ? <div className="text-muted-foreground mt-2 text-xs">{t('templates.breakdown', { image: data.templatePendingImageCount, video: data.templatePendingVideoCount })}</div> : null}
            </div>
          );
          return item.href ? (
            <button key={item.key} type="button" className="text-left" onClick={() => onNavigate(item.href!)}>{content}</button>
          ) : (
            <Tooltip key={item.key}><TooltipTrigger asChild><div tabIndex={0}>{content}</div></TooltipTrigger><TooltipContent>{t(`${item.key}.unavailable`)}</TooltipContent></Tooltip>
          );
        })}
      </div>
    </DashboardSectionShell>
  );
}
