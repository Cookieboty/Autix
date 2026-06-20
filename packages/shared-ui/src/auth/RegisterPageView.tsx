'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import {
  AuthErrorAlert,
  AuthInputField,
  AuthPasswordField,
} from './auth-fields';
import { AuthSplitShell } from './auth-shell';
import { getRegisterErrorMessage } from './error-utils';
import type { AuthRegisterFormValues, AuthRegisterResult } from './types';

type RegisterPageViewProps = {
  inviteCode?: string;
  onRegister: (values: AuthRegisterFormValues) => Promise<AuthRegisterResult>;
  onRequiresActivation: (email: string, message: string) => void;
  onPending: () => void;
  onLogin: () => void;
};

export function RegisterPageView({
  inviteCode = '',
  onRegister,
  onRequiresActivation,
  onPending,
  onLogin,
}: RegisterPageViewProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const t = useTranslations('auth');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AuthRegisterFormValues>();

  const password = watch('password');

  const submit = async (values: AuthRegisterFormValues) => {
    setLoading(true);
    setError('');
    try {
      const result = await onRegister(values);
      if (result?.requiresActivation) {
        onRequiresActivation(values.email, result.message || '');
        return;
      }
      onPending();
    } catch (err) {
      setError(getRegisterErrorMessage(err, t('registerFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitShell
      brandSubtitle={t('subtitle')}
      sideTitle={(
        <>
          {t('joinTitle')}
          <br />
          <span className="text-success">{t('startSmartAnalysis')}</span>
        </>
      )}
      sideDescription={t('registerDescription')}
      sideFooter={<>{'>'} {t('analyzeStructurePrompt')}</>}
      contentClassName="space-y-6"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t('createAccount')}</h1>
        <p className="text-foreground/50 text-sm">{t('registerHint')}</p>
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <AuthInputField
          id="username"
          label={t('username')}
          registration={register('username', {
            required: t('usernameRequired'),
            minLength: { value: 3, message: t('usernameMinLength') },
            maxLength: { value: 20, message: t('usernameMaxLength') },
          })}
          placeholder={t('usernamePlaceholder')}
          autoComplete="username"
          error={errors.username?.message}
        />

        <AuthInputField
          id="email"
          label={t('email')}
          type="email"
          registration={register('email', {
            required: t('emailRequired'),
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('emailInvalid') },
          })}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          error={errors.email?.message}
        />

        <AuthPasswordField
          id="password"
          label={t('password')}
          visible={isVisible}
          onToggle={() => setIsVisible((value) => !value)}
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
          registration={register('password', {
            required: t('passwordRequired'),
            minLength: { value: 6, message: t('passwordMinLength') },
          })}
          placeholder={t('passwordCharPlaceholder')}
          autoComplete="new-password"
          error={errors.password?.message}
        />

        <AuthPasswordField
          id="confirmPassword"
          label={t('confirmPassword')}
          visible={isConfirmVisible}
          onToggle={() => setIsConfirmVisible((value) => !value)}
          showLabel={t('showConfirmPassword')}
          hideLabel={t('hideConfirmPassword')}
          registration={register('confirmPassword', {
            required: t('confirmPasswordRequired'),
            validate: (value) => value === password || t('passwordMismatch'),
          })}
          placeholder={t('confirmPasswordPlaceholder')}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
        />

        <AuthInputField
          id="inviteCode"
          label={t('inviteCodeLabel')}
          registration={register('inviteCode')}
          defaultValue={inviteCode}
          placeholder={t('inviteCodePlaceholder')}
        />

        {error && <AuthErrorAlert>{error}</AuthErrorAlert>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer font-medium"
          size="lg"
        >
          {loading ? t('registering') : t('registerButton')}
        </Button>
      </form>

      <p className="text-center text-sm text-foreground/50">
        {t('hasAccount')}{' '}
        <button
          type="button"
          onClick={onLogin}
          className="cursor-pointer text-primary hover:underline"
        >
          {t('loginNow')}
        </button>
      </p>
    </AuthSplitShell>
  );
}
