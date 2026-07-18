'use client';

import { useState } from 'react';
import { Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { MembershipUpgradeView } from '../membership/MembershipUpgradeView';
import { cn } from '../ui/utils';
import {
  GROWTH_CTA_FOCUS,
  GROWTH_DIALOG_CONTENT,
  GROWTH_DIALOG_DESCRIPTION,
  GROWTH_DIALOG_FOOTER,
  GROWTH_DIALOG_HEADER,
  GROWTH_DIALOG_TITLE,
} from '../growth/dialog-styles';

const VIDEO_MEMBERSHIP_ERROR_CODES = new Set([
  'VIDEO_MEMBERSHIP_REQUIRED',
  'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED',
]);

export function isVideoMembershipError(code: string | null | undefined) {
  return Boolean(code && VIDEO_MEMBERSHIP_ERROR_CODES.has(code));
}

export function VideoMembershipUpgradeAlert({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  const t = useTranslations('videoWorkbench.membershipGate');
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<'notice' | 'plans'>('notice');

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) onDismiss?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          GROWTH_DIALOG_CONTENT,
          'max-h-[86vh]',
          view === 'notice' ? 'sm:max-w-[560px]' : 'sm:max-w-[980px]',
        )}
      >
        <DialogHeader className={GROWTH_DIALOG_HEADER}>
          <DialogTitle className={GROWTH_DIALOG_TITLE}>
            <Crown className="size-4 text-growth-accent" />
            {view === 'notice' ? t('title') : t('dialogTitle')}
          </DialogTitle>
          <DialogDescription className={GROWTH_DIALOG_DESCRIPTION}>
            {view === 'notice' ? t('description') : t('dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        {view === 'notice' ? (
          <>
            <DialogBody className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-sm leading-6 text-foreground/60">
                  {message || t('description')}
                </p>
              </div>
            </DialogBody>
            <DialogFooter className={GROWTH_DIALOG_FOOTER}>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {t('dismissAction')}
              </Button>
              <button
                type="button"
                className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-growth-accent px-5 text-sm font-bold text-background transition hover:bg-growth-accent-hover ${GROWTH_CTA_FOCUS}`}
                onClick={() => setView('plans')}
              >
                <Crown className="size-3.5" />
                {t('upgradeAction')}
              </button>
            </DialogFooter>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <MembershipUpgradeView
              descriptionKey="choosePlan"
              descriptionVariant="plain"
              showDowngradeToast={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
