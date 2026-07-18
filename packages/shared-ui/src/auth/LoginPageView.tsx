'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeLogo } from '../brand';
import { Button } from '../ui';
import { cn } from '../ui/utils';
import { Link } from '../navigation';
import { AuthErrorAlert, AuthInputField, AuthPasswordField } from './auth-fields';
import { AuthExperienceShell } from './auth-shell';
import { getLoginErrorMessage } from './error-utils';
import { EmailProviderIcon } from './oauth-provider-icons';
import { OAuthButtons } from './OAuthButtons';
import type { AuthLoginFormValues, AuthLoginResult, LoginOAuthProps } from './types';

type LoginFormPanelProps = {
  onLogin: (values: AuthLoginFormValues) => Promise<AuthLoginResult>;
  onSuccess: () => void;
  onPending: () => void;
  onForgotPassword: () => void;
  onRegister: () => void;
  className?: string;
  compact?: boolean;
  initialEmailMode?: boolean;
} & LoginOAuthProps;

export type LoginPageViewProps = LoginFormPanelProps;

export function LoginFormPanel({
  onLogin,
  onSuccess,
  onPending,
  onForgotPassword,
  onRegister,
  oauthProviders,
  onOAuthLogin,
  oauthLoadingProvider,
  oauthError,
  className,
  compact = false,
  initialEmailMode = false,
}: LoginFormPanelProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [emailMode, setEmailMode] = useState(initialEmailMode);
  const t = useTranslations('auth');

  useEffect(() => {
    setEmailMode(initialEmailMode);
  }, [initialEmailMode]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthLoginFormValues>();

  const submit = async (values: AuthLoginFormValues) => {
    setLoading(true);
    setError('');
    try {
      const { user } = await onLogin(values);
      if (user.status === 'PENDING') {
        onPending();
        return;
      }
      onSuccess();
    } catch (err) {
      setError(getLoginErrorMessage(err, t('loginFailed')));
    } finally {
      setLoading(false);
    }
  };

  const socialProviders = oauthProviders ?? [];
  const hasSocialProviders = socialProviders.length > 0;

  return (
    <div className={cn('space-y-4 text-white', className)}>
      {emailMode && (
        <button
          type="button"
          onClick={() => setEmailMode(false)}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/48 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {t('backToLoginOptions')}
        </button>
      )}

      <div className="flex justify-center">
        <ThemeLogo alt="Amux Studio" size={compact ? 36 : 42} variant="dark" priority />
      </div>

      <div className="space-y-1.5 pb-2 text-center">
        <h1 className={cn('font-bold leading-tight tracking-tight text-white', compact ? 'text-[26px]' : 'text-[32px]')}>
          {emailMode ? t('loginEmailTitle') : t('modalWelcome')}
        </h1>
        <p className="text-sm font-medium text-white/45">
          {emailMode ? t('modalEmailSubtitle') : t('modalSubtitle')}
        </p>
      </div>

      {!emailMode && (
        <button
          type="button"
          onClick={onRegister}
          className="flex h-13 w-full items-center justify-center gap-2.5 rounded-lg bg-[#26310f] px-4 text-[15px] font-semibold text-[#c9ff00] transition hover:bg-[#2f3c13]"
        >
          <Gift className="size-[18px]" />
          {t('signupDiscount')}
        </button>
      )}

      {!emailMode && hasSocialProviders ? (
        <OAuthButtons
          providers={socialProviders}
          loadingProvider={oauthLoadingProvider}
          onSelect={(provider) => onOAuthLogin?.(provider)}
          showDivider={false}
          className="gap-3"
          buttonClassName="h-13 rounded-lg border border-white/8 bg-[#1a1c1e] text-[15px] font-semibold text-white hover:bg-[#232628] hover:text-white"
        />
      ) : null}

      {oauthError ? <AuthErrorAlert>{oauthError}</AuthErrorAlert> : null}

      {!emailMode && (
        <div className="py-1 text-center text-xs font-medium uppercase text-white/35">
          {t('or')}
        </div>
      )}

      {emailMode ? (
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <AuthInputField
            id="username"
            label={t('accountLabel')}
            registration={register('username', { required: t('usernameRequired') })}
            placeholder={t('accountPlaceholder')}
            autoComplete="username"
            error={errors.username?.message}
            className="h-14 rounded-lg border-white/14 bg-transparent px-4 text-base text-white placeholder:text-white/38 focus-visible:border-white focus-visible:ring-white/20"
          />

          <div>
            <AuthPasswordField
              id="password"
              label={t('password')}
              visible={isVisible}
              onToggle={() => setIsVisible((value) => !value)}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              registration={register('password', { required: t('passwordRequired') })}
              placeholder={t('passwordPlaceholder')}
              autoComplete="current-password"
              error={errors.password?.message}
              className="h-14 rounded-lg border-white/14 bg-transparent px-4 text-base text-white placeholder:text-white/38 focus-visible:border-white focus-visible:ring-white/20"
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white/45">
              <button
                type="button"
                onClick={onForgotPassword}
                className="cursor-pointer hover:text-white hover:underline"
              >
                {t('forgotPassword')}
              </button>
              <button
                type="button"
                onClick={onRegister}
                className="cursor-pointer hover:text-white hover:underline"
              >
                {t('noAccount')} {t('registerNow')}
              </button>
            </div>
          </div>

          {error && <AuthErrorAlert>{error}</AuthErrorAlert>}

          <Button
            type="submit"
            disabled={loading}
            className="min-h-14 w-full cursor-pointer rounded-lg bg-[#23262f] text-base font-bold text-white hover:bg-[#2c303d]"
            size="lg"
          >
            {loading ? t('loggingIn') : t('login')}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEmailMode(true)}
          className="flex h-13 w-full items-center justify-center gap-2.5 rounded-lg border border-white/8 bg-[#1a1c1e] px-4 text-[15px] font-semibold text-white transition hover:bg-[#232628]"
        >
          <EmailProviderIcon className="size-[18px]" />
          {t('oauthContinueEmail')}
        </button>
      )}

      <p className="pt-6 text-center text-xs leading-5 text-white/30">
        {t.rich('modalTerms', {
          privacy: (chunks) => (
            <Link href="/docs/privacy" className="underline underline-offset-4 hover:text-white">
              {chunks}
            </Link>
          ),
          terms: (chunks) => (
            <Link href="/docs/terms" className="underline underline-offset-4 hover:text-white">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}

export function LoginPageView(props: LoginPageViewProps) {
  return (
    <AuthExperienceShell>
      <LoginFormPanel {...props} />
    </AuthExperienceShell>
  );
}
