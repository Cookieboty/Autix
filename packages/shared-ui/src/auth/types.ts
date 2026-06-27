export type AuthLoginFormValues = {
  username: string;
  password: string;
};

export type AuthRegisterFormValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  inviteCode: string;
};

export type AuthResetPasswordFormValues = {
  newPassword: string;
  confirmPassword: string;
};

export type AuthForgotPasswordFormValues = {
  email: string;
};

export type AuthActivationStatus = 'processing' | 'success' | 'error' | 'invalid';

export type AuthLoginResult = {
  user: {
    status?: string | null;
  };
};

export type AuthRegisterResult = {
  requiresActivation?: boolean;
  message?: string;
} | undefined;

export type OAuthProviderId = 'google' | 'apple' | 'github' | 'microsoft';

export type LoginOAuthProps = {
  oauthProviders?: OAuthProviderId[];
  oauthComingSoon?: OAuthProviderId[];
  onOAuthLogin?: (provider: OAuthProviderId) => void;
  oauthLoadingProvider?: OAuthProviderId | null;
  oauthError?: string;
};
