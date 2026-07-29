'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';

export function SectionErrorState({ onRetry }: { onRetry: () => unknown }) {
  const t = useTranslations('chatDashboard.common');
  return (
    <div className="border-destructive/25 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center">
      <Badge variant="destructive">{t('error')}</Badge>
      <div className="text-foreground text-2xl font-semibold">—</div>
      <p className="text-muted-foreground mt-2 text-sm">{t('loadFailed')}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => void onRetry()}>
        <RefreshCw className="mr-2 h-4 w-4" />{t('retry')}
      </Button>
    </div>
  );
}
