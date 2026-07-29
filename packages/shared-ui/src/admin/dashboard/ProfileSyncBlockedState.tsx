'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import {
  authActions,
  type ProfileSyncStatus,
} from '@autix/shared-store';
import { Button } from '../../ui/button';
import { useRouter } from '../../navigation';

export interface ProfileSyncBlockedStateProps {
  status: Exclude<ProfileSyncStatus, 'ready'>;
}

export function ProfileSyncBlockedState({ status }: ProfileSyncBlockedStateProps) {
  const t = useTranslations('chatDashboard.profileSync');
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  if (status === 'syncing') {
    return (
      <div className="border-border bg-card flex min-h-72 flex-col items-center justify-center rounded-xl border px-6 text-center">
        <LoaderCircle className="text-muted-foreground h-8 w-8 animate-spin" />
        <h1 className="text-foreground mt-5 text-xl font-semibold">{t('syncingTitle')}</h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
          {t('syncingDescription')}
        </p>
      </div>
    );
  }

  const retry = async () => {
    setRetrying(true);
    try {
      await authActions.retryProfileSync();
    } catch {
      // The global status remains broken; the user can retry or reload.
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="border-destructive/30 bg-card flex min-h-72 flex-col items-center justify-center rounded-xl border px-6 text-center">
      <AlertTriangle className="text-destructive h-8 w-8" />
      <h1 className="text-foreground mt-5 text-xl font-semibold">{t('brokenTitle')}</h1>
      <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-6">
        {t('brokenDescription')}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => void retry()} disabled={retrying}>
          {retrying ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t('retry')}
        </Button>
        <Button variant="outline" onClick={() => router.refresh()} disabled={retrying}>
          {t('reload')}
        </Button>
      </div>
    </div>
  );
}
