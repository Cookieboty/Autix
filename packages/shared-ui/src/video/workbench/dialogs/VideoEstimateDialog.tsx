import { Calculator, Loader2, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../../ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import type { VideoClipEstimate } from '../constants';

export function VideoEstimateDialog({
  open,
  onOpenChange,
  loading,
  error,
  estimates,
  accountBalance,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: string | null;
  estimates: VideoClipEstimate[];
  accountBalance: number | null;
  onConfirm: () => void;
}) {
  const t = useTranslations('videoWorkbench.estimateDialog');
  const total = estimates.reduce((sum, item) => sum + item.estimate.estimatedCost, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[60vh] space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('estimating')}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('totalCost')}</span>
                  <strong>{t('credits', { value: total })}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('balance')}</span>
                  <span>
                    {accountBalance == null
                      ? t('balanceUnknown')
                      : t('credits', { value: accountBalance })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('submittedClips')}</span>
                  <span>{t('clipsCount', { count: estimates.length })}</span>
                </div>
              </div>
              <div className="space-y-2">
                {estimates.map((item) => (
                  <div key={item.clip.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {item.clip.title ||
                            t('clipTitleFallback', { order: item.clip.order })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.resolution} · {item.seconds}s · {item.estimate.ruleName}
                        </div>
                      </div>
                      <strong className="shrink-0">
                        {t('credits', { value: item.estimate.estimatedCost })}
                      </strong>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      {item.estimate.items.map((detail) => (
                        <div key={detail.label} className="flex items-center justify-between gap-2">
                          <span>{detail.label}</span>
                          <span>{t('credits', { value: detail.amount })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={loading || Boolean(error) || estimates.length === 0}>
            {t('confirm')}
            <Play className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
