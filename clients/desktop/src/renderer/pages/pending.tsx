'use client';

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card, CardContent, Button } from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@autix/shared-store';
import { userApi } from '@autix/sdk';

export function PendingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useTranslations('auth');
  const { logout } = useAuthStore();
  const email = searchParams.get('email') || '';
  const activationMode = searchParams.get('activation') === '1';
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState(searchParams.get('message') || '');

  const handleBack = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const resendActivation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { data } = await userApi.post('/auth/resend-activation', { email });
      setNotice(data?.message || '');
    } catch (err) {
      const e = err as { msg?: string; response?: { data?: { msg?: string } } };
      setNotice(e.msg || e.response?.data?.msg || t('activationFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md bg-secondary border border-border">
        <CardContent className="text-center space-y-6 py-12">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-warning/20 border-2 border-warning/40">
              <Clock className="w-10 h-10 text-warning" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {activationMode ? t('activationTitle') : t('pendingTitle')}
            </h1>
            <p className="text-foreground/60 text-sm leading-relaxed">
              {notice || t('pendingDescription')}
            </p>
            <p className="text-foreground/40 text-sm">
              {activationMode ? email : t('pendingNote')}
            </p>
          </div>

          {activationMode && email && (
            <Button
              variant="outline"
              onClick={resendActivation}
              disabled={resending}
              className="w-full cursor-pointer font-medium"
              size="lg"
            >
              {resending ? t('sending') : t('resendActivation')}
            </Button>
          )}

          <Button
            onClick={handleBack}
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
