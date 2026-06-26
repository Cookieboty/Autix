'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';

export function EmailSupplementBanner(props: {
  visible: boolean; submitting?: boolean; sentTo?: string | null; error?: string;
  onSubmit: (email: string) => void;
}) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  if (!props.visible) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm">
      <span className="text-amber-900">
        {props.sentTo ? t('emailSupplementSent', { email: props.sentTo }) : t('emailSupplementPrompt')}
      </span>
      {!props.sentTo ? (
        <>
          <input
            className="rounded border px-2 py-1"
            type="email"
            placeholder={t('emailSupplementPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button size="sm" disabled={props.submitting || !email} onClick={() => props.onSubmit(email)}>
            {props.submitting ? t('oauthRedirecting') : t('emailSupplementSubmit')}
          </Button>
        </>
      ) : null}
      {props.error ? <span className="text-red-600">{props.error}</span> : null}
    </div>
  );
}
