'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '../ui';
import { getResendActivationMessage } from './error-utils';

type PendingPageViewProps = {
  email?: string;
  activationMode?: boolean;
  initialNotice?: string;
  onResendActivation: (email: string) => Promise<{ message?: string }>;
  onBackToLogin: () => void | Promise<void>;
};

export function PendingPageView({
  email = '',
  activationMode = false,
  initialNotice = '',
  onResendActivation,
  onBackToLogin,
}: PendingPageViewProps) {
  const t = useTranslations('auth');
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState(initialNotice);

  const resendActivation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const data = await onResendActivation(email);
      setNotice(data?.message || '');
    } catch (err) {
      setNotice(getResendActivationMessage(err, t('activationFailed')));
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
              type="button"
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
            type="button"
            onClick={onBackToLogin}
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
