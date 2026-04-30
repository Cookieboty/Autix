'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Crown, Coins, Package, ShoppingBag, Gift, Copy, Check, Share2 } from 'lucide-react';
import { Button } from '@heroui/react';
import { membershipApi, inviteApi, type MembershipInfo, type InviteCode } from '@/lib/api';

const quickActions = [
  { key: 'upgrade', icon: Crown, href: '/membership/upgrade' },
  { key: 'pointsHistory', icon: Coins, href: '/membership/points' },
  { key: 'buyPoints', icon: Package, href: '/membership/packages' },
  { key: 'myOrders', icon: ShoppingBag, href: '/membership/orders' },
  { key: 'inviteFriends', icon: Gift, href: '/membership/invite' },
] as const;

export default function MembershipPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [info, setInfo] = useState<MembershipInfo | null>(null);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      membershipApi.getMe().then((res) => setInfo(res.data)),
      inviteApi.getCode().then((res) => setInviteCode(res.data)).catch(() => {}),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const inviteLink = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?aff=${inviteCode.code}`
    : '';

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  const m = info?.membership;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-14 px-6 flex items-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('center')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Status card */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('currentLevel')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {m ? m.level.name : t('noMembership')}
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
                {m ? new Date(m.expiresAt).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('autoRenew')}</p>
              <p className="text-sm font-semibold" style={{ color: m?.autoRenew ? 'var(--success)' : 'var(--muted)' }}>
                {m ? (m.autoRenew ? t('autoRenewOn') : t('autoRenewOff')) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              onClick={() => router.push(href)}
              className="flex flex-col items-center gap-2.5 p-5 rounded-xl transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                {t(key)}
              </span>
            </button>
          ))}
        </div>

        {/* Invite / share card */}
        {inviteCode && (
          <div
            className="rounded-xl p-5 mt-6"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
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
              <Button size="sm" variant="ghost" className="cursor-pointer flex-shrink-0" onPress={handleCopyLink}>
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
