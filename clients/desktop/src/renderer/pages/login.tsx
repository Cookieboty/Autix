import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginPageView, type AuthLoginFormValues, type OAuthProviderId } from '@autix/shared-ui/auth';
import { authActions } from '@autix/shared-store';
import { getEnv } from '@autix/platform';
import { useTranslations } from 'next-intl';

const SYSTEM_CODE = 'chat';

// 保持具名导出 LoginPage（App.tsx 以 `import { LoginPage }` 引入，勿改成 default）
export function LoginPage() {
  const navigate = useNavigate();
  const t = useTranslations('auth');
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [oauthError, setOAuthError] = useState('');

  useEffect(() => {
    authActions.fetchOAuthProviders().then(({ providers: list }) => {
      setProviders(list as OAuthProviderId[]);
    }).catch(() => {});
  }, []);

  const onOAuthLogin = async (provider: OAuthProviderId) => {
    setLoadingProvider(provider);
    setOAuthError('');
    try {
      const apiBaseUrl = getEnv().apiUrl;
      const r = await window.electron.auth.startOAuth({ provider, apiBaseUrl, systemCode: SYSTEM_CODE });
      if (r.error || !r.code) { setOAuthError(t('oauthGenericError')); setLoadingProvider(null); return; }
      const result = await authActions.completeOAuthLogin(r.code);
      setLoadingProvider(null);
      navigate(result.user?.status === 'PENDING' ? '/pending' : '/chat');
    } catch {
      setOAuthError(t('oauthExpired'));
      setLoadingProvider(null);
    }
  };

  return (
    <LoginPageView
      onLogin={(values: AuthLoginFormValues) =>
        authActions.login(values, { storeProfileCollections: false, keepProfileCollectionsOnUser: true })}
      onPending={() => navigate('/pending')}
      onSuccess={() => navigate('/chat')}
      onForgotPassword={() => navigate('/forgot-password')}
      onRegister={() => navigate('/register')}
      oauthProviders={providers}
      onOAuthLogin={onOAuthLogin}
      oauthLoadingProvider={loadingProvider}
      oauthError={oauthError}
    />
  );
}
