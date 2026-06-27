'use client';

import type { AuthModalMode } from '@autix/shared-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import { AuthExperienceShell } from './auth-shell';
import { ForgotPasswordPanel } from './ForgotPasswordPageView';
import { LoginFormPanel } from './LoginPageView';
import { RegisterFormPanel } from './RegisterPageView';
import type {
  AuthForgotPasswordFormValues,
  AuthLoginFormValues,
  AuthLoginResult,
  AuthRegisterFormValues,
  AuthRegisterResult,
  LoginOAuthProps,
} from './types';

type AuthModalViewProps = {
  open: boolean;
  mode: AuthModalMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: AuthModalMode) => void;
  onLogin: (values: AuthLoginFormValues) => Promise<AuthLoginResult>;
  onLoginSuccess: () => void;
  onPending: () => void;
  onRegister: (values: AuthRegisterFormValues) => Promise<AuthRegisterResult>;
  onRequiresActivation: (email: string, message: string) => void;
  onSendResetEmail: (email: AuthForgotPasswordFormValues['email']) => Promise<unknown>;
} & LoginOAuthProps;

export function AuthModalView({
  open,
  mode,
  onOpenChange,
  onModeChange,
  onLogin,
  onLoginSuccess,
  onPending,
  onRegister,
  onRequiresActivation,
  onSendResetEmail,
  oauthProviders,
  oauthComingSoon,
  onOAuthLogin,
  oauthLoadingProvider,
  oauthError,
}: AuthModalViewProps) {
  const content =
    mode === 'register' ? (
      <RegisterFormPanel
        compact
        onRegister={onRegister}
        onRequiresActivation={onRequiresActivation}
        onPending={onPending}
        onLogin={() => onModeChange('entry')}
      />
    ) : mode === 'forgot' ? (
      <ForgotPasswordPanel
        compact
        onSendResetEmail={onSendResetEmail}
        onBackToLogin={() => onModeChange('login')}
      />
    ) : (
      <LoginFormPanel
        compact
        initialEmailMode={mode === 'login'}
        onLogin={onLogin}
        onPending={onPending}
        onSuccess={onLoginSuccess}
        onForgotPassword={() => onModeChange('forgot')}
        onRegister={() => onModeChange('register')}
        oauthProviders={oauthProviders}
        oauthComingSoon={oauthComingSoon}
        onOAuthLogin={onOAuthLogin}
        oauthLoadingProvider={oauthLoadingProvider}
        oauthError={oauthError}
      />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-md border-0 bg-transparent p-0 text-white ring-0 sm:w-[min(1180px,calc(100vw-2rem))] sm:max-w-[1180px]"
      >
        <DialogTitle className="sr-only">Sign in to Amux Studio</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in or create an account to continue.
        </DialogDescription>
        <AuthExperienceShell
          modal
          showClose
          onClose={() => onOpenChange(false)}
          closeLabel="Close"
        >
          {content}
        </AuthExperienceShell>
      </DialogContent>
    </Dialog>
  );
}
