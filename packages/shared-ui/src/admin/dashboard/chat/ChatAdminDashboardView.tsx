'use client';

import { useTranslations } from 'next-intl';
import { RangeControl } from './RangeControl';
import { useChatAdminDashboardController } from './useChatAdminDashboardController';
import { ChatDashboardHeader } from './sections/ChatDashboardHeader';
import { PendingInboxSection } from './sections/PendingInboxSection';
import { GenerationHealthSection } from './sections/GenerationHealthSection';
import { BillingSummarySection } from './sections/BillingSummarySection';
import { ContentPulseSection } from './sections/ContentPulseSection';
import { RiskSignalsSection } from './sections/RiskSignalsSection';
import { ChatQuickActionsSection } from './sections/ChatQuickActionsSection';

export function ChatAdminDashboardView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const t = useTranslations('chatDashboard');
  const controller = useChatAdminDashboardController();
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p><h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight">{t('title')}</h1><p className="text-muted-foreground mt-2 text-sm">{t('description')}</p></div>
        <div className="text-muted-foreground text-xs">{controller.tz ? t('timezone', { tz: controller.tz }) : t('timezonePending')}</div>
      </header>
      <RangeControl range={controller.range} validation={controller.validation} onPreset={controller.setPreset} onCustom={controller.setCustom} />
      <ChatDashboardHeader metrics={controller.header} pending={controller.pending} generation={controller.generation} billing={controller.billing} content={controller.content} validation={controller.validation} />
      <PendingInboxSection query={controller.pending} onNavigate={onNavigate} />
      <GenerationHealthSection query={controller.generation} validation={controller.validation} />
      <BillingSummarySection query={controller.billing} validation={controller.validation} />
      <ContentPulseSection query={controller.content} validation={controller.validation} />
      <RiskSignalsSection query={controller.risk} validation={controller.validation} tz={controller.tz} />
      <ChatQuickActionsSection pending={controller.pending.data} billing={controller.billing.data} onNavigate={onNavigate} />
    </div>
  );
}
