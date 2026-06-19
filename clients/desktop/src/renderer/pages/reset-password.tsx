'use client';

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { Button, Input } from '@autix/shared-ui/ui';
import { useTranslations } from 'next-intl';
import { userApi } from '@autix/sdk';

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const t = useTranslations('auth');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordForm>();
  const password = watch('newPassword');

  const onSubmit = async (data: ResetPasswordForm) => {
    setLoading(true);
    setError('');
    try {
      await userApi.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { msg?: string; response?: { data?: { msg?: string } } };
      setError(e.msg || e.response?.data?.msg || t('resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">{t('invalidResetLink')}</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('invalidResetLinkDesc')}</p>
          <Button
            onClick={() => navigate('/login')}
            className="cursor-pointer font-medium"
            size="lg"
          >
            {t('backToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ThemeLogo
              alt="Amux Studio"
              size={28}
            />
            <span className="text-xl font-bold text-foreground">Amux Studio</span>
          </div>
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              color: 'var(--foreground)',
              backgroundColor: 'var(--secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {t('resetSuccess')}
          </div>
          <Button
            onClick={() => navigate('/login')}
            className="w-full cursor-pointer font-medium"
            size="lg"
          >
            {t('backToLogin')}
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">{t('resetPasswordTitle')}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t('resetPasswordHint')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-sm font-medium text-foreground/80 block">
              {t('newPassword')}
            </label>
            <div className="relative">
              <Input
                id="newPassword"
                aria-label={t('newPassword')}
                type={isVisible ? 'text' : 'password'}
                {...register('newPassword', {
                  required: t('passwordRequired'),
                  minLength: { value: 8, message: t('passwordMinLength') },
                })}
                placeholder={t('newPasswordPlaceholder')}
                autoComplete="new-password"
                className="w-full"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                style={{ color: 'var(--muted)' }}
                aria-label={isVisible ? t('hidePassword') : t('showPassword')}
                onClick={() => setIsVisible(!isVisible)}
              >
                {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80 block">
              {t('confirmNewPassword')}
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                aria-label={t('confirmNewPassword')}
                type={isConfirmVisible ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: t('confirmPasswordRequired'),
                  validate: (v) => v === password || t('passwordMismatch'),
                })}
                placeholder={t('confirmNewPasswordPlaceholder')}
                autoComplete="new-password"
                className="w-full"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                style={{ color: 'var(--muted)' }}
                aria-label={isConfirmVisible ? t('hideConfirmPassword') : t('showConfirmPassword')}
                onClick={() => setIsConfirmVisible(!isConfirmVisible)}
              >
                {isConfirmVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && (
            <div
              className="rounded-xl p-3 text-sm"
              style={{
                color: 'var(--danger)',
                backgroundColor: 'color-mix(in oklch, var(--danger) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--danger) 20%, transparent)',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer font-medium"
            size="lg"
          >
            {loading ? t('resetting') : t('resetPassword')}
          </Button>
        </form>

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
