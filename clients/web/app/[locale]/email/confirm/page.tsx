'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { authActions } from '@autix/shared-store';

export default function EmailConfirmPage() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useTranslations('auth');
  const [state, setState] = useState<'processing' | 'success' | 'error'>('processing');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; ran.current = true;
    const token = params.get('token');
    if (!token) { setState('error'); return; }
    authActions.confirmSupplementEmail(token)
      .then(() => { void authActions.refreshProfile(); setState('success'); })
      .catch(() => setState('error'));
  }, [params]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p>{t(state === 'processing' ? 'emailConfirmProcessing' : state === 'success' ? 'emailConfirmSuccess' : 'emailConfirmError')}</p>
      {state !== 'processing' ? <button className="underline" onClick={() => router.replace('/profile')}>{t('backToProfile')}</button> : null}
    </div>
  );
}
