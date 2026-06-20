'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import {
  AuthErrorAlert,
  AuthInfoBox,
  AuthPasswordField,
} from './auth-fields';
import { AuthBrandMark, AuthCenteredShell, AuthPageHeader } from './auth-shell';
import { getResetPasswordErrorMessage } from './error-utils';
import type { AuthResetPasswordFormValues } from './types';

type ResetPasswordPageViewProps = {
  token?: string | null;
  onResetPassword: (token: string, newPassword: string) => Promise<unknown>;
  onBackToLogin: () => void;
};

export function ResetPasswordPageView({
  token,
  onResetPassword,
  onBackToLogin,
}: ResetPasswordPageViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const t = useTranslations('auth');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AuthResetPasswordFormValues>();
  const password = watch('newPassword');

  const submit = async (values: AuthResetPasswordFormValues) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await onResetPassword(token, values.newPassword);
      setSuccess(true);
    } catch (err) {
      setError(getResetPasswordErrorMessage(err, t('resetFailed')));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCenteredShell className="space-y-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">{t('invalidResetLink')}</h1>
        <p className="text-foreground/50 text-sm">{t('invalidResetLinkDesc')}</p>
        <Button
          type="button"
          onClick={onBackToLogin}
          className="cursor-pointer font-medium"
          size="lg"
        >
          {t('backToLogin')}
        </Button>
      </AuthCenteredShell>
    );
  }

  if (success) {
    return (
      <AuthCenteredShell className="space-y-6 text-center">
        <div className="mb-2">
          <AuthBrandMark />
        </div>
        <AuthInfoBox>{t('resetSuccess')}</AuthInfoBox>
        <Button
          type="button"
          onClick={onBackToLogin}
          className="w-full cursor-pointer font-medium"
          size="lg"
        >
          {t('backToLogin')}
        </Button>
      </AuthCenteredShell>
    );
  }

  return (
    <AuthCenteredShell>
      <AuthPageHeader
        title={t('resetPasswordTitle')}
        description={t('resetPasswordHint')}
      />

      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        <AuthPasswordField
          id="newPassword"
          label={t('newPassword')}
          visible={isVisible}
          onToggle={() => setIsVisible((value) => !value)}
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
          registration={register('newPassword', {
            required: t('passwordRequired'),
            minLength: { value: 8, message: t('passwordMinLength') },
          })}
          placeholder={t('newPasswordPlaceholder')}
          autoComplete="new-password"
          error={errors.newPassword?.message}
        />

        <AuthPasswordField
          id="confirmPassword"
          label={t('confirmNewPassword')}
          visible={isConfirmVisible}
          onToggle={() => setIsConfirmVisible((value) => !value)}
          showLabel={t('showConfirmPassword')}
          hideLabel={t('hideConfirmPassword')}
          registration={register('confirmPassword', {
            required: t('confirmPasswordRequired'),
            validate: (value) => value === password || t('passwordMismatch'),
          })}
          placeholder={t('confirmNewPasswordPlaceholder')}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
        />

        {error && <AuthErrorAlert>{error}</AuthErrorAlert>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer font-medium"
          size="lg"
        >
          {loading ? t('resetting') : t('resetPassword')}
        </Button>
      </form>

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
