'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '../ui';
import { AuthErrorAlert, AuthInfoBox } from './auth-fields';
import { AuthBrandMark, AuthCenteredShell } from './auth-shell';
import { getActivationErrorMessage } from './error-utils';
import type { AuthActivationStatus } from './types';

type ActivatePageViewProps = {
  token?: string | null;
  onActivate: (token: string) => Promise<unknown>;
  onBackToLogin: () => void;
  variant?: 'plain' | 'card';
  showBrand?: boolean;
  invalidTitleKey?: 'invalidActivationLink' | 'activationTitle';
  successBoxTone?: 'secondary' | 'background';
};

export function ActivatePageView({
  token,
  onActivate,
  onBackToLogin,
  variant = 'plain',
  showBrand = true,
  invalidTitleKey = 'invalidActivationLink',
  successBoxTone = 'secondary',
}: ActivatePageViewProps) {
  const t = useTranslations('auth');
  const [status, setStatus] = useState<AuthActivationStatus>(token ? 'processing' : 'invalid');
  const [errorMsg, setErrorMsg] = useState('');
  const onActivateRef = useRef(onActivate);

  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    if (!token) return;
    onActivateRef.current(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setErrorMsg(getActivationErrorMessage(err, t('activationFailed')));
        setStatus('error');
      });
  }, [token, t]);

  const content = (
    <>
      {showBrand && (
        <div className="mb-2">
          <AuthBrandMark />
        </div>
      )}

      {variant === 'card' && (
        <h1 className="text-2xl font-bold text-foreground">{t('activationTitle')}</h1>
      )}

      {status === 'invalid' && (
        <>
          {variant === 'plain' && (
            <h1 className="text-2xl font-bold text-foreground">{t(invalidTitleKey)}</h1>
          )}
          <p className="text-foreground/50 text-sm">{t('invalidActivationLinkDesc')}</p>
        </>
      )}

      {status === 'processing' && (
        <p className="text-foreground/60 text-sm">{t('activationProcessing')}</p>
      )}

      {status === 'success' && (
        successBoxTone === 'background' ? (
          <div className="rounded-xl p-4 text-sm text-foreground bg-background border border-border">
            {t('activationSuccess')}
          </div>
        ) : (
          <AuthInfoBox>{t('activationSuccess')}</AuthInfoBox>
        )
      )}

      {status === 'error' && (
        <AuthErrorAlert>{errorMsg}</AuthErrorAlert>
      )}

      <Button
        type="button"
        onClick={onBackToLogin}
        className="w-full cursor-pointer font-medium"
        size="lg"
      >
        {t('backToLogin')}
      </Button>
    </>
  );

  if (variant === 'card') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md bg-secondary border border-border">
          <CardContent className="text-center space-y-6 py-12">
            {content}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthCenteredShell className="space-y-6 text-center">
      {content}
    </AuthCenteredShell>
  );
}
