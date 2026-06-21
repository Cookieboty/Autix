'use client';

import { Check, Copy, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMembershipInviteController } from '@autix/shared-store';
import { Button, SidebarTrigger } from '../ui';
import { useInviteSharingEnabled } from '../hooks/useModelConfigEnabled';

type MembershipInviteViewProps = {
  showSidebarTrigger?: boolean;
  activeColorVar?: '--brand' | '--accent';
};

function rewardStatusStyle(rewarded: boolean, activeColorVar: '--brand' | '--accent') {
  if (activeColorVar === '--accent') {
    return rewarded
      ? { backgroundColor: '#22c55e20', color: 'var(--success)' }
      : { backgroundColor: '#6b728020', color: '#6b7280' };
  }

  return rewarded
    ? { backgroundColor: 'var(--success-soft)', color: 'var(--success)' }
    : { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' };
}

export function MembershipInviteView({
  showSidebarTrigger = false,
  activeColorVar = '--brand',
}: MembershipInviteViewProps) {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');
  const inviteSharingEnabled = useInviteSharingEnabled(true);
  const {
    code,
    records,
    copiedField,
    inviteLink,
    isLoading,
    copyToClipboard,
  } = useMembershipInviteController();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 h-12 px-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
        <h1
          className={`${showSidebarTrigger ? 'ml-1 ' : ''}text-sm font-semibold`}
          style={{ color: 'var(--foreground)' }}
        >
          {t('inviteTitle')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div
          className="rounded-xl p-5 mb-6 flex items-start gap-3"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Gift className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: `var(${activeColorVar})` }} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('inviteDesc')}</p>
        </div>

        {!inviteSharingEnabled && (
          <div
            className="rounded-xl p-4 mb-6 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            {t('inviteDisabled')}
          </div>
        )}

        {inviteSharingEnabled && code && (
          <div className="space-y-3 mb-6">
            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('inviteCode')}</p>
                <p className="text-sm font-mono font-semibold" style={{ color: 'var(--foreground)' }}>
                  {code.code}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => copyToClipboard(code.code, 'code')}
              >
                {copiedField === 'code'
                  ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                  : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1 text-xs">
                  {copiedField === 'code' ? tCommon('copied') : t('copyCode')}
                </span>
              </Button>
            </div>

            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('inviteLink')}</p>
                <p
                  className="text-xs font-mono truncate"
                  style={{ color: 'var(--foreground)' }}
                >
                  {inviteLink}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer flex-shrink-0"
                onClick={() => copyToClipboard(inviteLink, 'link')}
              >
                {copiedField === 'link'
                  ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                  : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1 text-xs">
                  {copiedField === 'link' ? tCommon('copied') : t('copyLink')}
                </span>
              </Button>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          {t('inviteRecords')}
        </h2>

        {records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('noInviteRecords')}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-secondary)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('invitee')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderStatus')}</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('rewardPoints')}</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>{t('orderTime')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--foreground)' }}>
                      {record.inviteeUserId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                        style={rewardStatusStyle(record.rewarded, activeColorVar)}
                      >
                        {record.rewarded ? t('inviteeRewarded') : t('inviteePending')}
                      </span>
                    </td>
                    <td className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>
                      {record.rewardPoints}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {new Date(record.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
