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
              {estimates.map((item) => (
                <div key={item.clip.id} className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{t('pricingRule')}</div>
                      {/* TODO(pricing phase 3): render a localized task label, not the raw taskType id */}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.estimate.taskType}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold text-foreground">
                        {t('credits', { value: total })}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('totalCost')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground">{t('totalDuration')}</div>
                      <div className="mt-1 font-medium text-foreground">{t('seconds', { value: item.seconds })}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('resolution')}</div>
                      <div className="mt-1 font-medium text-foreground">{item.resolution}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('balance')}</div>
                      <div className="mt-1 font-medium text-foreground">
                        {accountBalance == null
                          ? t('balanceUnknown')
                          : t('credits', { value: accountBalance })}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
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
