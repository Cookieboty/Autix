'use client';

import { useTranslations } from 'next-intl';
import { Calculator, ChevronRight, Loader2 } from 'lucide-react';
import type { TaskEstimateResult } from '@autix/shared-store';
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui';

export function ImageWorkbenchEstimateDialog({
  open,
  onOpenChange,
  estimateLoading,
  estimate,
  accountBalance,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateLoading: boolean;
  estimate: TaskEstimateResult | null;
  accountBalance: number | null;
  onConfirm: () => void;
}) {
  const t = useTranslations('imageStudio.page');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            {t('confirmTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('confirmDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {estimateLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('estimatingCost')}
            </div>
          ) : estimate ? (
            <>
              <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('estimatedCost')}</span>
                  <strong>{t('pointsValue', { points: estimate.estimatedCost })}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('availableBalance')}</span>
                  <span>
                    {accountBalance == null
                      ? t('unknown')
                      : t('pointsValue', { points: accountBalance })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('taskType')}</span>
                  {/* TODO(pricing phase 3): render a localized task label, not the raw taskType id */}
                  <span>{estimate.taskType}</span>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                <div className="font-medium">{t('costDetails')}</div>
                {estimate.breakdown.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 text-muted-foreground"
                  >
                    {/* TODO(pricing phase 3): render a localized term label, not the raw term id */}
                    <span>{item.id}</span>
                    <span>{t('pointsValue', { points: item.contribution })}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{t('noEstimate')}</div>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{t('cancel')}</Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={estimateLoading || !estimate}>
            {t('confirmGenerate')}
            <ChevronRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
