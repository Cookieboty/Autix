'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Coins, Crown, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useInsufficientPointsStore,
  useMyMembershipQuery,
} from '@autix/shared-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { MembershipPackagesView } from '../membership/MembershipPackagesView';
import { MembershipUpgradeView } from '../membership/MembershipUpgradeView';

type PaidTab = 'packages' | 'plans';

export function InsufficientPointsDialog({
  onNavigateOrder,
}: {
  onNavigateOrder?: (orderId: string) => void;
  onNavigateUpgrade?: () => void;
  onNavigatePackages?: () => void;
}) {
  const t = useTranslations('insufficientPoints');
  const open = useInsufficientPointsStore((s) => s.open);
  const payload = useInsufficientPointsStore((s) => s.payload);
  const closeDialog = useInsufficientPointsStore((s) => s.closeDialog);

  const membershipQuery = useMyMembershipQuery(open);
  const membership = membershipQuery.data?.membership ?? null;
  const pointsBalance = membershipQuery.data?.pointsBalance ?? null;

  const isPaidMember = useMemo(() => {
    if (!membership) return false;
    if (membership.status !== 'ACTIVE') return false;
    if (new Date(membership.expiresAt) <= new Date()) return false;
    return Number(membership.level?.level ?? 0) > 0;
  }, [membership]);

  const currentLevelName = membership?.level?.name ?? t('levelFree');

  const [paidTab, setPaidTab] = useState<PaidTab>('packages');

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeDialog();
      setPaidTab('packages');
    }
  };

  const required = payload?.required ?? null;
  const available = payload?.available ?? pointsBalance;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] w-[min(96vw,1040px)] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-[1040px]',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {isPaidMember ? t('descriptionPaid') : t('descriptionFree')}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border bg-muted/30 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              {isPaidMember ? (
                <Crown className="size-3.5 text-primary" />
              ) : (
                <Crown className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{t('currentLevel')}</span>
              <span className="font-semibold text-foreground">{currentLevelName}</span>
            </div>
            {typeof available === 'number' ? (
              <div className="flex items-center gap-1.5">
                <Coins className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('current')}</span>
                <span className="font-semibold text-foreground">{available}</span>
              </div>
            ) : null}
            {typeof required === 'number' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{t('required')}</span>
                <span className="font-semibold text-foreground">{required}</span>
              </div>
            ) : null}
            {typeof required === 'number' && typeof available === 'number' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{t('shortfall')}</span>
                <span className="font-semibold text-amber-500">
                  {Math.max(0, required - available)}
                </span>
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => handleOpenChange(false)}
            >
              {t('dismiss')}
            </Button>
          </div>
        </div>

        {isPaidMember ? (
          <>
            <div className="flex shrink-0 items-center gap-1 border-b border-border px-6 pt-3">
              <TabButton
                active={paidTab === 'packages'}
                onClick={() => setPaidTab('packages')}
                icon={<Package className="size-3.5" />}
                label={t('packagesHeading')}
              />
              <TabButton
                active={paidTab === 'plans'}
                onClick={() => setPaidTab('plans')}
                icon={<Crown className="size-3.5" />}
                label={t('plansHeading')}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {paidTab === 'packages' ? (
                <MembershipPackagesView
                  showSidebarTrigger={false}
                  descriptionKey="packageTip"
                  descriptionVariant="plain"
                  showPackageDetails
                  requirePaidLevel={false}
                  disablePurchaseForNonMember={false}
                  onNavigateOrder={onNavigateOrder}
                  onNavigateUpgrade={() => setPaidTab('plans')}
                />
              ) : (
                <MembershipUpgradeView
                  descriptionKey="choosePlan"
                  descriptionVariant="plain"
                  showDowngradeToast={false}
                  onNavigateOrder={onNavigateOrder}
                />
              )}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MembershipUpgradeView
              descriptionKey="choosePlan"
              descriptionVariant="plain"
              showDowngradeToast={false}
              onNavigateOrder={onNavigateOrder}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function InsufficientPointsGate(props: {
  onNavigateOrder?: (orderId: string) => void;
  onNavigateUpgrade?: () => void;
  onNavigatePackages?: () => void;
}) {
  return <InsufficientPointsDialog {...props} />;
}
