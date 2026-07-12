'use client';
import { useTranslations } from 'next-intl';
import { Check, Link2, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import type { OAuthProviderId } from '../auth/types';

const NAME: Record<OAuthProviderId, string> = {
  google: 'Google',
  apple: 'Apple',
  github: 'GitHub',
  microsoft: 'Microsoft',
};

export type AccountSecuritySectionProps = {
  allProviders: OAuthProviderId[];
  linkedProviders: OAuthProviderId[];
  busyProvider?: OAuthProviderId | null;
  /** 已翻译的错误文案;绑定失败时展示(为空则不显示) */
  error?: string | null;
  onLink: (p: OAuthProviderId) => void;
  onUnlink: (p: OAuthProviderId) => void;
};

export function AccountSecuritySection(props: AccountSecuritySectionProps) {
  const t = useTranslations('profile');
  // 渲染 union：已绑定的 provider 即使当前被停配（不在 allProviders）也要显示，让用户能解绑旧绑定
  const rows = [...new Set([...props.allProviders, ...props.linkedProviders])];
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('accountSecurityTitle')}</CardTitle>
        <CardDescription>{t('accountSecurityDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{props.error}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((p) => {
            const linked = props.linkedProviders.includes(p);
            const enabled = props.allProviders.includes(p);
            const busy = props.busyProvider === p;
            return (
              <li key={p} className="flex min-h-16 items-center gap-3 px-3 py-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-foreground">
                  {NAME[p][0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{NAME[p]}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {linked ? <Check className="size-3.5 text-emerald-500" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
                    {linked ? t('linked') : t('notLinked')}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={linked ? 'outline' : 'default'}
                  disabled={busy || (!enabled && !linked)}
                  onClick={() => (linked ? props.onUnlink(p) : props.onLink(p))}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {linked ? t('unlink') : t('link')}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
