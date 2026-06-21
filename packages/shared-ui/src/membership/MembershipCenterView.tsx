'use client';

import { Check, Coins, Copy, Crown, Gift, Package, Share2, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMembershipCenterController } from '@autix/shared-store';
import { Button, SidebarTrigger } from '../ui';

type QuickAction = {
  key: string;
  icon: typeof Crown;
  href: string;
};

type MembershipCenterViewProps = {
  showSidebarTrigger?: boolean;
  activeColorVar?: '--brand' | '--accent';
  onNavigate: (href: string) => void;
};

const quickActions: QuickAction[] = [
  { key: 'benefitsOverview', icon: ShieldCheck, href: '/membership/benefits' },
  { key: 'upgrade', icon: Crown, href: '/membership/upgrade' },
  { key: 'pointsHistory', icon: Coins, href: '/membership/points' },
  { key: 'buyPoints', icon: Package, href: '/membership/packages' },
  { key: 'myOrders', icon: ShoppingBag, href: '/membership/orders' },
  { key: 'inviteFriends', icon: Gift, href: '/membership/invite' },
];

export function MembershipCenterView({
  showSidebarTrigger = false,
  activeColorVar = '--brand',
  onNavigate,
}: MembershipCenterViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const {
    info,
    inviteCode,
    inviteLink,
    copied,
    isLoading,
    copyInviteLink,
  } = useMembershipCenterController();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  const membership = info?.membership;
  const iconColor = `var(${activeColorVar})`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold text-foreground`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('center')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div
          className="rounded-xl p-5 mb-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('currentLevel')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {membership ? membership.level.name : t('noMembership')}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('pointsBalance')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {info?.pointsBalance ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('expiresAt')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {membership ? new Date(membership.expiresAt).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('autoRenew')}</p>
              <p
                className="text-sm font-semibold"
                style={{ color: membership?.autoRenew ? 'var(--success)' : 'var(--muted)' }}
              >
                {membership ? (membership.autoRenew ? t('autoRenewOn') : t('autoRenewOff')) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => onNavigate(href)}
              className="flex flex-col items-center gap-2.5 p-5 rounded-xl transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
              <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                {t(key)}
              </span>
            </button>
          ))}
        </div>

        {inviteCode && (
          <div
            className="rounded-xl p-5 mt-6"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4" style={{ color: iconColor }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('sharePromotion')}
              </h2>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{t('shareDesc')}</p>
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
            >
              <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--foreground)' }}>
                {inviteLink}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer flex-shrink-0"
                onClick={copyInviteLink}
              >
                {copied
                  ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                  : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1 text-xs">{copied ? tCommon('copied') : t('copyLink')}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
