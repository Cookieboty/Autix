'use client';

import { useTranslations } from 'next-intl';

export function ChatLoadingState() {
  const tc = useTranslations('common');

  return (
    <div className="flex-1 flex items-center justify-center bg-transparent text-muted-foreground">
      <div className="text-center space-y-3">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
        <p className="text-sm">{tc('loading')}</p>
      </div>
    </div>
  );
}
