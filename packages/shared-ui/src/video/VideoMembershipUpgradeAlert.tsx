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
          'flex max-h-[86vh] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground',
          view === 'notice' ? 'sm:max-w-[560px]' : 'sm:max-w-[980px]',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-4 text-primary" />
            {view === 'notice' ? t('title') : t('dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {view === 'notice' ? t('description') : t('dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        {view === 'notice' ? (
          <>
            <DialogBody className="space-y-4 px-5 py-5">
              <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
                <p className="text-sm leading-6 text-muted-foreground">
                  {message || t('description')}
                </p>
              </div>
            </DialogBody>
            <DialogFooter className="border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {t('dismissAction')}
              </Button>
              <Button className="gap-1.5" onClick={() => setView('plans')}>
                <Crown className="size-3.5" />
                {t('upgradeAction')}
              </Button>
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
