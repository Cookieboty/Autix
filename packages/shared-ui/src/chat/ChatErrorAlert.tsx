'use client';

import { AlertCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ErrorMessageBody, splitErrorMessage } from './chat-error-message';

export function ChatErrorAlert({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss: () => void;
}) {
  const t = useTranslations('chat');
  const parsed = error ? splitErrorMessage(error, t('error.requestFailedTitle')) : null;
  if (!parsed) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-3">
      <Alert
        variant="destructive"
        className="relative border-destructive/40 bg-destructive/10 pr-10 text-destructive"
      >
        <AlertCircle />
        <AlertTitle>{parsed.title}</AlertTitle>
        <AlertDescription>
          <ErrorMessageBody message={parsed.body} />
        </AlertDescription>
        <button
          type="button"
          aria-label={t('dismiss')}
          className="absolute right-2 top-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </button>
      </Alert>
    </div>
  );
}
