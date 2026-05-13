'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Card, CardContent, Button } from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';
import { userApi } from '@/lib/api';

export default function PendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const email = searchParams.get('email') || '';
  const activationMode = searchParams.get('activation') === '1';
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState(searchParams.get('message') || '');

  const resendActivation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { data } = await userApi.post('/auth/resend-activation', { email });
      setNotice(data?.message || '');
    } catch (err: any) {
      setNotice(err.msg || err.response?.data?.msg || t('activationFailed'));
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
            onClick={() => router.push('/login')}
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
