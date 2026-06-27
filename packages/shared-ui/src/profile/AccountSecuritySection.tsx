'use client';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import type { OAuthProviderId } from '../auth/types';

const NAME: Record<OAuthProviderId, string> = { google: 'Google', apple: 'Apple', github: 'GitHub' };

export type AccountSecuritySectionProps = {
  allProviders: OAuthProviderId[];
  linkedProviders: OAuthProviderId[];
  busyProvider?: OAuthProviderId | null;
  onLink: (p: OAuthProviderId) => void;
  onUnlink: (p: OAuthProviderId) => void;
};

export function AccountSecuritySection(props: AccountSecuritySectionProps) {
  const t = useTranslations('profile');
  // 渲染 union：已绑定的 provider 即使当前被停配（不在 allProviders）也要显示，让用户能解绑旧绑定
  const rows = [...new Set([...props.allProviders, ...props.linkedProviders])];
  if (!rows.length) return null;
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">{t('accountSecurityTitle')}</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((p) => {
          const linked = props.linkedProviders.includes(p);
          const enabled = props.allProviders.includes(p);
          return (
            <li key={p} className="flex items-center justify-between">
              <span>{NAME[p]}{linked ? ` · ${t('linked')}` : ''}</span>
              <Button
                variant={linked ? 'outline' : 'default'}
                // 未启用且未绑定 → 无操作可做，禁用；已绑定（即便停配）仍可解绑
                disabled={props.busyProvider === p || (!enabled && !linked)}
                onClick={() => (linked ? props.onUnlink(p) : props.onLink(p))}
              >
                {linked ? t('unlink') : t('link')}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
