'use client';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import { cn } from '../ui/utils';
import { OAuthProviderIcon } from './oauth-provider-icons';
import type { OAuthProviderId } from './types';

const LABEL_KEY: Record<OAuthProviderId, string> = {
  google: 'oauthContinueGoogle',
  apple: 'oauthContinueApple',
  github: 'oauthContinueGithub',
  microsoft: 'oauthContinueMicrosoft',
};

export function OAuthButtons(props: {
  providers: OAuthProviderId[];
  loadingProvider?: OAuthProviderId | null;
  onSelect: (p: OAuthProviderId) => void;
  comingSoonProviders?: OAuthProviderId[];
  className?: string;
  buttonClassName?: string;
  showDivider?: boolean;
}) {
  const t = useTranslations('auth');
  const hasFunctional = props.providers.length > 0;
  const hasComingSoon = (props.comingSoonProviders?.length ?? 0) > 0;
  if (!hasFunctional && !hasComingSoon) return null;
  return (
    <div className={cn('flex flex-col gap-2', props.className)}>
      {props.showDivider !== false && (
        <div className="text-center text-xs text-muted-foreground">{t('oauthDivider')}</div>
      )}
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
            className={cn('relative gap-3', props.buttonClassName)}
          >
            <OAuthProviderIcon provider={p} className="size-5" />
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
            className={cn(
              'relative cursor-not-allowed gap-3 text-muted-foreground opacity-50',
              props.buttonClassName,
            )}
          >
            <OAuthProviderIcon provider={p} className="size-5" />
            {t(labelKey)} · {t('oauthComingSoon')}
          </Button>
        );
      })}
    </div>
  );
}
