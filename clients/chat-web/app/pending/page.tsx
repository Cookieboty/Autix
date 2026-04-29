'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Card, CardContent, Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

export default function PendingPage() {
  const router = useRouter();
  const t = useTranslations('auth');

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
            onPress={() => router.push('/login')}
            className="w-full cursor-pointer font-medium"
            variant="primary"
            size="lg"
          >
            {t('backToLogin')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
