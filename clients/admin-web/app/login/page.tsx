'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@autix/shared-ui/ui';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
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
  const { setUser } = useAuthStore();
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
      const { data: tokens } = await api.post('/auth/login', data);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      const { data: profile } = await api.get('/auth/profile');
      setUser(profile, profile.menus || [], tokens.systems || profile.systems || []);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.msg || err.response?.data?.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden
        bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Amux Admin"
              width={40}
              height={40}
              className="rounded-md"
              priority
            />
            <div>
              <div className="text-white font-bold text-xl font-mono">Amux Admin</div>
              <div className="text-white/60 text-xs">{t('console')}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              {t('brandTitle')}
              <br />
              {t('brandSubtitle')}
            </h2>
            <p className="mt-3 text-white/70 text-sm leading-relaxed">
              {t('brandDescription')}
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <span className="text-white/40 text-xs font-mono">v2.0.0</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <Image
                src="/logo.png"
                alt="Amux Admin"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-2xl font-bold font-mono text-primary">Amux Admin</span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">{t('mobileSubtitle')}</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t('welcome')}</h1>
            <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
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
            >
              {loading ? t('loggingIn') : t('loginButton')}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {t('copyright')}
          </p>
        </div>
      </div>
    </div>
  );
}
