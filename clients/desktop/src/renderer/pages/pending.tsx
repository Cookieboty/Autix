'use client';

import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@autix/shared-store';

export function PendingPage() {
  const navigate = useNavigate();
  const t = useTranslations('auth');
  const { logout } = useAuthStore();

  const handleBack = async () => {
    await logout();
    navigate('/login', { replace: true });
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
            <h1 className="text-2xl font-bold text-foreground">{t('pendingTitle')}</h1>
            <p className="text-foreground/60 text-sm leading-relaxed">
              {t('pendingDescription')}
            </p>
            <p className="text-foreground/40 text-sm">{t('pendingNote')}</p>
          </div>

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
