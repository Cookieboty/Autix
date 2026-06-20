'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authActions } from '@autix/shared-store';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { Button } from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';

type Status = 'processing' | 'success' | 'error' | 'invalid';

export default function ActivatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const t = useTranslations('auth');
  const [status, setStatus] = useState<Status>(token ? 'processing' : 'invalid');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    authActions
      .activate(token)
      .then(() => setStatus('success'))
      .catch((err: any) => {
        setErrorMsg(err.msg || err.response?.data?.message || t('activationFailed'));
        setStatus('error');
      });
  }, [token, t]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ThemeLogo
            alt="Amux Studio"
            size={28}
          />
          <span className="text-xl font-bold text-foreground">Amux Studio</span>
        </div>

        {status === 'invalid' && (
          <>
            <h1 className="text-2xl font-bold text-foreground">{t('invalidActivationLink')}</h1>
            <p className="text-foreground/50 text-sm">{t('invalidActivationLinkDesc')}</p>
          </>
        )}

        {status === 'processing' && (
          <p className="text-foreground/60 text-sm">{t('activationProcessing')}</p>
        )}

        {status === 'success' && (
          <div className="rounded-xl p-4 text-sm text-foreground bg-secondary border border-border">
            {t('activationSuccess')}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20">
            {errorMsg}
          </div>
        )}

        <Button
          onClick={() => router.push('/login')}
          className="w-full cursor-pointer font-medium"
          size="lg"
        >
          {t('backToLogin')}
        </Button>
      </div>
    </div>
  );
}
