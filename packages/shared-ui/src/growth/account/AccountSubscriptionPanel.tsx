'use client';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AccountPanelPlaceholder } from './AccountPanelPlaceholder';

export function AccountSubscriptionPanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  return (
    <AccountPanelPlaceholder
      icon={Wallet}
      title={t('subscription.title')}
      subtitle={t('subscription.subtitle')}
      emptyLabel={t('subscription.comingSoon')}
    />
  );
}
