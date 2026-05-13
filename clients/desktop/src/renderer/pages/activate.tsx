'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { userApi } from '@autix/shared-lib';
import { Card, CardContent, Button } from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';

type Status = 'processing' | 'success' | 'error' | 'invalid';

export function ActivatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const t = useTranslations('auth');
  const [status, setStatus] = useState<Status>(token ? 'processing' : 'invalid');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    userApi
      .post('/auth/activate', { token })
      .then(() => setStatus('success'))
      .catch((err: any) => {
        setErrorMsg(err.msg || err.response?.data?.message || t('activationFailed'));
        setStatus('error');
      });
  }, [token, t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md bg-secondary border border-border">
        <CardContent className="text-center space-y-6 py-12">
          <h1 className="text-2xl font-bold text-foreground">{t('activationTitle')}</h1>

          {status === 'invalid' && (
            <div className="space-y-2">
              <p className="text-foreground/60 text-sm">{t('invalidActivationLinkDesc')}</p>
            </div>
          )}

          {status === 'processing' && (
            <p className="text-foreground/60 text-sm">{t('activationProcessing')}</p>
          )}

          {status === 'success' && (
            <div className="rounded-xl p-4 text-sm text-foreground bg-background border border-border">
              {t('activationSuccess')}
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-xl p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <Button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full cursor-pointer font-medium"
            size="lg"
          >
            {t('backToLogin')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
