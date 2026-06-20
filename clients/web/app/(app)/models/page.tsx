'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ModelsView } from '@autix/shared-ui/models';
import { SidebarTrigger } from '@autix/shared-ui/ui';
import {
  getPublicSystemSettings,
  type PublicSystemSettings,
} from '@autix/shared-store';
import { AMUX_API_URL } from '@/lib/constants';

export default function ModelsPage() {
  const t = useTranslations('models');
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const modelConfigEnabled = settings?.features.modelConfigEnabled ?? false;

  useEffect(() => {
    getPublicSystemSettings()
      .then((data) => setSettings(data))
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  useEffect(() => {
    if (!settingsLoading && !modelConfigEnabled) {
      router.replace('/');
    }
  }, [modelConfigEnabled, router, settingsLoading]);

  if (!settingsLoading && !modelConfigEnabled) {
    return <ModelsPageStatus message={t('returningHome')} />;
  }

  if (settingsLoading) {
    return <ModelsPageStatus message={t('loadingSystemConfig')} />;
  }

  return (
    <ModelsView
      amuxHost={settings?.integrations.amuxHost ?? AMUX_API_URL}
      amuxClientId={settings?.integrations.amuxClientId}
      amuxModelImportEnabled={settings?.features.amuxModelImportEnabled ?? false}
      headerLeading={<SidebarTrigger className="-ml-1" />}
      variant="web"
      drawerMode="sheet"
    />
  );
}

function ModelsPageStatus({ message }: { message: string }) {
  const t = useTranslations('models');

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Settings className="ml-1 h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{t('title')}</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
          {message}
        </div>
      </div>
    </div>
  );
}
