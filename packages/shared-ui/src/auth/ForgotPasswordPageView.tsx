'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import { AuthInfoBox, AuthInputField } from './auth-fields';
import { AuthCenteredShell, AuthPageHeader } from './auth-shell';
import type { AuthForgotPasswordFormValues } from './types';

type ForgotPasswordPageViewProps = {
  onSendResetEmail: (email: string) => Promise<unknown>;
  onBackToLogin: () => void;
};

export function ForgotPasswordPageView({
  onSendResetEmail,
  onBackToLogin,
}: ForgotPasswordPageViewProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useTranslations('auth');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthForgotPasswordFormValues>();

  const submit = async (values: AuthForgotPasswordFormValues) => {
    setLoading(true);
    try {
      await onSendResetEmail(values.email);
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCenteredShell>
      <AuthPageHeader
        title={t('forgotPasswordTitle')}
        description={t('forgotPasswordHint')}
      />

      {sent ? (
        <div className="space-y-6">
          <AuthInfoBox>{t('resetEmailSent')}</AuthInfoBox>
          <Button
            type="button"
            onClick={onBackToLogin}
            className="w-full cursor-pointer font-medium"
            size="lg"
          >
            {t('backToLogin')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} className="space-y-5">
          <AuthInputField
            id="email"
            label={t('emailLabel')}
            type="email"
            registration={register('email', {
              required: t('emailRequired'),
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('emailInvalid') },
            })}
            placeholder={t('emailPlaceholder')}
            autoComplete="email"
            error={errors.email?.message}
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer font-medium"
            size="lg"
          >
            {loading ? t('sending') : t('sendResetLink')}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-foreground/50">
        <button
          type="button"
          onClick={onBackToLogin}
          className="cursor-pointer text-primary hover:underline"
        >
          {t('backToLogin')}
        </button>
      </p>
    </AuthCenteredShell>
  );
}
