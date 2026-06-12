'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { Button, Input } from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';
import { userApi } from '@autix/shared-lib';

interface ForgotPasswordForm {
  email: string;
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useTranslations('auth');

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setLoading(true);
    try {
      await userApi.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <ThemeLogo
              alt="Amux Studio"
              size={28}
            />
            <span className="text-xl font-bold text-foreground">Amux Studio</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('forgotPasswordTitle')}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t('forgotPasswordHint')}</p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div
              className="rounded-xl p-4 text-sm"
              style={{
                color: 'var(--foreground)',
                backgroundColor: 'var(--secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {t('resetEmailSent')}
            </div>
            <Button
              onClick={() => navigate('/login')}
              className="w-full cursor-pointer font-medium"
              size="lg"
            >
              {t('backToLogin')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground/80 block">
                {t('emailLabel')}
              </label>
              <Input
                id="email"
                aria-label={t('emailLabel')}
                type="email"
                {...register('email', {
                  required: t('emailRequired'),
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('emailInvalid') },
                })}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                className="w-full"
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.email.message}</p>
              )}
            </div>

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

        <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="cursor-pointer text-primary hover:underline"
          >
            {t('backToLogin')}
          </button>
        </p>
      </div>
    </div>
  );
}
