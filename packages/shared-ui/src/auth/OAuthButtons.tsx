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
}) {
  const t = useTranslations('auth');
  if (!props.providers.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-center text-xs text-muted-foreground">{t('oauthDivider')}</div>
      {props.providers.map((p) => (
        <Button
          key={p}
          type="button"
          variant="outline"
          disabled={Boolean(props.loadingProvider)}
          onClick={() => props.onSelect(p)}
        >
          {props.loadingProvider === p ? t('oauthRedirecting') : t(LABEL_KEY[p])}
        </Button>
      ))}
    </div>
  );
}
