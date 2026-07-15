'use client';

import { TimerReset } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AccountPanelPlaceholder } from './AccountPanelPlaceholder';
import { AccountUsageChart } from './AccountUsageChart';

export function AccountUsagePanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  return (
    <AccountPanelPlaceholder icon={TimerReset} title={t('usage.title')} subtitle={t('usage.subtitle')}>
      <div className="rounded-2xl bg-[rgb(24,25,28)] p-6">
        <p className="mb-6 text-sm font-medium text-foreground/70">{t('usage.chartTitle')}</p>
        <AccountUsageChart days={30} barHeight={140} />
      </div>
    </AccountPanelPlaceholder>
  );
}
