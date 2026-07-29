'use client';

import { useTranslations } from 'next-intl';
import { CircleHelp, LoaderCircle } from 'lucide-react';
import {
  useAuthStore,
  useSwitchAdminSystemMutation,
} from '@autix/shared-store';
import { Button } from '../../ui/button';

export interface UnsupportedSystemStateProps {
  systemCode?: string;
}

export function UnsupportedSystemState({ systemCode }: UnsupportedSystemStateProps) {
  const t = useTranslations('chatDashboard.unsupported');
  const systems = useAuthStore((state) => state.systems);
  const mutation = useSwitchAdminSystemMutation();
  const knownSystems = systems.filter(
    (system) => system.code === 'chat' || system.code === 'admin-system',
  );

  return (
    <div className="border-border bg-card flex min-h-72 flex-col items-center justify-center rounded-xl border px-6 text-center">
      <CircleHelp className="text-muted-foreground h-9 w-9" />
      <h1 className="text-foreground mt-5 text-xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-6">
        {t('description', { code: systemCode || t('unknownCode') })}
      </p>
      {knownSystems.length > 0 ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {knownSystems.map((system) => (
            <Button
              key={system.id}
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(system.id)}
            >
              {mutation.isPending && mutation.variables === system.id ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('switchTo', { name: system.name })}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-6 text-sm">{t('noKnownSystem')}</p>
      )}
    </div>
  );
}
