'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ThemeLogo } from '@autix/shared-ui/brand';
import { Button, Input, Label } from '@autix/shared-ui/ui';
import { authActions } from '@autix/shared-store';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  Users,
  Layers,
  Activity,
} from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const features = [
    { icon: Shield, text: t('featureAuth') },
    { icon: Users, text: t('featurePermission') },
    { icon: Layers, text: t('featureMultiSystem') },
    { icon: Activity, text: t('featureAudit') },
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      await authActions.login(data, {
        includeTokenSystems: true,
        keepProfileCollectionsOnUser: true,
      });
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.msg || err.response?.data?.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-background to-secondary">
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <ThemeLogo
              alt="Amux Admin"
              size={40}
              priority
            />
            <div>
              <div className="text-foreground font-bold text-xl">Amux Admin</div>
              <div className="text-foreground/60 text-xs">{t('console')}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              {t('brandTitle')}
              <br />
              {t('brandSubtitle')}
            </h2>
            <p className="mt-3 text-foreground/60 text-sm leading-relaxed">
              {t('brandDescription')}
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/30 border border-primary/30">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground/80 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <span className="text-foreground/40 text-xs font-mono">v2.0.0</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <ThemeLogo
                alt="Amux Admin"
                size={28}
              />
              <span className="text-xl font-bold text-foreground">Amux Admin</span>
            </div>
            <p className="text-foreground/60 text-sm mt-1">{t('mobileSubtitle')}</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t('welcome')}</h1>
            <p className="text-foreground/60 text-sm">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('username')}
              </Label>
              <Input
                id="username"
                {...register('username', { required: t('usernameRequired') })}
                placeholder="admin"
                autoComplete="username"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: t('passwordRequired') })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 rotate-45" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer font-medium"
              size="lg"
            >
              {loading ? t('loggingIn') : t('loginButton')}
            </Button>
          </form>

          <p className="text-center text-xs text-foreground/40">
            {t('copyright')}
          </p>
        </div>
      </div>
    </div>
  );
}
