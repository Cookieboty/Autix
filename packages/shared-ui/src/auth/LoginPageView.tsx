'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { BarChart3, BookOpen, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui';
import { AuthErrorAlert, AuthInputField, AuthPasswordField } from './auth-fields';
import { AuthSplitShell } from './auth-shell';
import { getLoginErrorMessage } from './error-utils';
import { OAuthButtons } from './OAuthButtons';
import type { AuthLoginFormValues, AuthLoginResult, LoginOAuthProps } from './types';

type LoginPageViewProps = {
  onLogin: (values: AuthLoginFormValues) => Promise<AuthLoginResult>;
  onSuccess: () => void;
  onPending: () => void;
  onForgotPassword: () => void;
  onRegister: () => void;
} & LoginOAuthProps;

export function LoginPageView({
  onLogin,
  onSuccess,
  onPending,
  onForgotPassword,
  onRegister,
  oauthProviders,
  oauthComingSoon,
  onOAuthLogin,
  oauthLoadingProvider,
  oauthError,
}: LoginPageViewProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations('auth');

  const features = [
    { icon: BarChart3, text: t('featureAnalysis') },
    { icon: BookOpen, text: t('featureHistory') },
    { icon: Zap, text: t('featureRealtime') },
  ];

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

  return (
    <AuthSplitShell
      brandSubtitle={t('subtitle')}
      sideTitle={(
        <>
          {t('aiDrivenTitle')}
          <br />
          <span className="text-success">{t('requirementAnalysis')}</span>{' '}
          {t('assistant')}
        </>
      )}
      sideDescription={t('aiDescription')}
      sideFooter={<>{'>'} {t('analyzeLoginPrompt')}</>}
      features={features}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{t('startConversation')}</h1>
        <p className="text-foreground/50 text-sm">{t('loginHint')}</p>
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        <AuthInputField
          id="username"
          label={t('accountLabel')}
          registration={register('username', { required: t('usernameRequired') })}
          placeholder={t('accountPlaceholder')}
          autoComplete="username"
          error={errors.username?.message}
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
          />
          <div className="text-right mt-1">
            <button
              type="button"
              onClick={onForgotPassword}
              className="cursor-pointer text-xs text-primary hover:underline"
            >
              {t('forgotPassword')}
            </button>
          </div>
        </div>

        {error && <AuthErrorAlert>{error}</AuthErrorAlert>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer font-medium"
          size="lg"
        >
          {loading ? t('loggingIn') : t('startChat')}
        </Button>
      </form>

      {oauthError ? <AuthErrorAlert>{oauthError}</AuthErrorAlert> : null}
      {(oauthProviders?.length || oauthComingSoon?.length) ? (
        <OAuthButtons
          providers={oauthProviders ?? []}
          loadingProvider={oauthLoadingProvider}
          onSelect={(p) => onOAuthLogin?.(p)}
          comingSoonProviders={oauthComingSoon}
        />
      ) : null}

      <p className="text-center text-sm text-foreground/50">
        {t('noAccount')}{' '}
        <button
          type="button"
          onClick={onRegister}
          className="cursor-pointer text-primary hover:underline"
        >
          {t('registerNow')}
        </button>
      </p>

      <p className="text-center text-xs text-foreground/30">
        {t('copyright')}
      </p>
    </AuthSplitShell>
  );
}
