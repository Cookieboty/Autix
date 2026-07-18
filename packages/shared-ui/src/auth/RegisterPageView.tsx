'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeLogo } from '../brand';
import { Button } from '../ui';
import { cn } from '../ui/utils';
import {
  AuthErrorAlert,
  AuthInputField,
  AuthPasswordField,
} from './auth-fields';
import { AuthExperienceShell } from './auth-shell';
import { getRegisterErrorMessage } from './error-utils';
import type { AuthRegisterFormValues, AuthRegisterResult } from './types';

type RegisterFormPanelProps = {
  inviteCode?: string;
  onRegister: (values: AuthRegisterFormValues) => Promise<AuthRegisterResult>;
  onRequiresActivation: (email: string, message: string) => void;
  onPending: () => void;
  onLogin: () => void;
  className?: string;
  compact?: boolean;
};

export type RegisterPageViewProps = RegisterFormPanelProps;

export function RegisterFormPanel({
  inviteCode = '',
  onRegister,
  onRequiresActivation,
  onPending,
  onLogin,
  className,
  compact = false,
}: RegisterFormPanelProps) {
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
  } = useForm<AuthRegisterFormValues>({
    defaultValues: { inviteCode },
  });

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

  const inputClassName =
    'h-12 rounded-lg border-white/14 bg-transparent px-4 text-base text-white placeholder:text-white/38 focus-visible:border-white focus-visible:ring-white/20';

  return (
    <div className={cn('space-y-5 text-white', className)}>
      <button
        type="button"
        onClick={onLogin}
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
          {t('modalRegisterTitle')}
        </h1>
        <p className="text-sm font-medium text-white/40">{t('modalRegisterSubtitle')}</p>
      </div>

      <div className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#26310f] px-3 text-sm font-bold text-[#c9ff00]">
        <Gift className="size-4" />
        {t('signupDiscount')}
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-3">
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
          className={inputClassName}
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
          className={inputClassName}
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
          className={inputClassName}
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
          className={inputClassName}
        />

        <AuthInputField
          id="inviteCode"
          label={t('inviteCodeLabel')}
          registration={register('inviteCode')}
          placeholder={t('inviteCodePlaceholder')}
          className={inputClassName}
        />

        {error && <AuthErrorAlert>{error}</AuthErrorAlert>}

        <Button
          type="submit"
          disabled={loading}
          className="min-h-13 w-full cursor-pointer rounded-lg bg-white text-base font-bold text-black hover:bg-[#c9ff00]"
          size="lg"
        >
          {loading ? t('registering') : t('registerButton')}
        </Button>
      </form>

      <p className="text-center text-sm text-white/45">
        {t('hasAccount')}{' '}
        <button
          type="button"
          onClick={onLogin}
          className="cursor-pointer text-white underline underline-offset-4"
        >
          {t('loginNow')}
        </button>
      </p>
    </div>
  );
}

export function RegisterPageView(props: RegisterPageViewProps) {
  return (
    <AuthExperienceShell>
      <RegisterFormPanel {...props} />
    </AuthExperienceShell>
  );
}
