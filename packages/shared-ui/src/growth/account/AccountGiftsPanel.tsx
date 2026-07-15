'use client';

import { Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AccountPanelPlaceholder } from './AccountPanelPlaceholder';

export function AccountGiftsPanel() {
  const t = useTranslations('publicGrowth.accountSettings');
  return (
    <AccountPanelPlaceholder
      icon={Gift}
      title={t('gifts.title')}
      subtitle={t('gifts.subtitle')}
      emptyLabel={t('gifts.comingSoon')}
    />
  );
}
