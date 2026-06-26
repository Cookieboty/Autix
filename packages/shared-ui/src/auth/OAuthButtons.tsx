'use client';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import type { OAuthProviderId } from './types';

const LABEL_KEY: Record<OAuthProviderId, string> = {
  google: 'oauthContinueGoogle',
  apple: 'oauthContinueApple',
  github: 'oauthContinueGithub',
};

export function OAuthButtons(props: {
  providers: OAuthProviderId[];
  loadingProvider?: OAuthProviderId | null;
  onSelect: (p: OAuthProviderId) => void;
  comingSoonProviders?: OAuthProviderId[];
}) {
  const t = useTranslations('auth');
  const hasFunctional = props.providers.length > 0;
  const hasComingSoon = (props.comingSoonProviders?.length ?? 0) > 0;
  if (!hasFunctional && !hasComingSoon) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-xs text-muted-foreground">{t('oauthDivider')}</div>
      {props.providers.map((p) => {
        const labelKey = LABEL_KEY[p];
        if (!labelKey) return null;
        return (
          <Button
            key={p}
            type="button"
            variant="outline"
            disabled={Boolean(props.loadingProvider)}
            onClick={() => props.onSelect(p)}
          >
            {props.loadingProvider === p ? t('oauthRedirecting') : t(labelKey)}
          </Button>
        );
      })}
      {props.comingSoonProviders?.map((p) => {
        const labelKey = LABEL_KEY[p];
        if (!labelKey) return null;
        return (
          <Button
            key={`coming-soon-${p}`}
            type="button"
            variant="outline"
            disabled
            className="cursor-not-allowed opacity-50 text-muted-foreground"
          >
            {t(labelKey)} · {t('oauthComingSoon')}
          </Button>
        );
      })}
    </div>
  );
}
