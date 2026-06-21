'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from '../../ui';

export function ImageWorkbenchErrorAlert({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const t = useTranslations('imageStudio.page');

  return (
    <div className="shrink-0 px-4 pt-4">
      <Alert variant="destructive" className="relative pr-24">
        <AlertCircle />
        <AlertTitle>{t('requestFailedTitle')}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2"
          onClick={onClose}
        >
          {t('close')}
        </Button>
      </Alert>
    </div>
  );
}
