'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeLogo } from '../brand';
import { Button } from '../ui';
import { cn } from '../ui/utils';
import { AuthInfoBox, AuthInputField } from './auth-fields';
import { AuthExperienceShell } from './auth-shell';
import type { AuthForgotPasswordFormValues } from './types';

type ForgotPasswordPanelProps = {
  onSendResetEmail: (email: string) => Promise<unknown>;
  onBackToLogin: () => void;
  className?: string;
  compact?: boolean;
};

type ForgotPasswordPageViewProps = ForgotPasswordPanelProps & {
  experience?: boolean;
};

export function ForgotPasswordPanel({
  onSendResetEmail,
  onBackToLogin,
  className,
  compact = false,
}: ForgotPasswordPanelProps) {
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
    <div className={cn('space-y-6 text-white', className)}>
      <button
        type="button"
        onClick={onBackToLogin}
        className="inline-flex items-center gap-2 text-sm font-medium text-white/48 transition hover:text-white"
      >
        <ArrowLeft className="size-4" />
        {t('backToLogin')}
      </button>

      <div className="flex justify-center">
        <ThemeLogo alt="Amux Studio" size={compact ? 36 : 42} variant="dark" priority />
      </div>

      <div className="space-y-2 text-center">
        <h1 className={cn('font-bold leading-tight tracking-normal text-white', compact ? 'text-3xl' : 'text-4xl')}>
          {t('forgotPasswordTitle')}
        </h1>
        <p className="text-sm font-medium text-white/40">{t('forgotPasswordHint')}</p>
      </div>

      {sent ? (
        <div className="space-y-5">
          <AuthInfoBox>
            <span className="inline-flex items-start gap-3">
              <MailCheck className="mt-0.5 size-5 shrink-0 text-[#c9ff00]" />
              <span>{t('resetEmailSent')}</span>
            </span>
          </AuthInfoBox>
          <Button
            type="button"
            onClick={onBackToLogin}
            className="min-h-13 w-full cursor-pointer rounded-lg bg-white text-base font-bold text-black hover:bg-[#c9ff00]"
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
            className="h-14 rounded-lg border-white/14 bg-transparent px-4 text-base text-white placeholder:text-white/38 focus-visible:border-white focus-visible:ring-white/20"
          />

          <Button
            type="submit"
            disabled={loading}
            className="min-h-13 w-full cursor-pointer rounded-lg bg-white text-base font-bold text-black hover:bg-[#c9ff00]"
            size="lg"
          >
            {loading ? t('sending') : t('sendResetLink')}
          </Button>
        </form>
      )}
    </div>
  );
}

export function ForgotPasswordPageView({
  onSendResetEmail,
  onBackToLogin,
  experience = true,
}: ForgotPasswordPageViewProps) {
  return (
    <AuthExperienceShell modal={!experience}>
      <ForgotPasswordPanel
        onSendResetEmail={onSendResetEmail}
        onBackToLogin={onBackToLogin}
      />
    </AuthExperienceShell>
  );
}
