'use client';

import { useTranslations } from 'next-intl';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const t = useTranslations('layout');
  const online = useNetworkStatus();
  if (online) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '6px 12px',
        textAlign: 'center',
        fontSize: 12,
        backgroundColor: 'var(--warning)',
        color: 'var(--warning-foreground)',
      }}
    >
      {t('offlineBanner')}
    </div>
  );
}
