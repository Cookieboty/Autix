'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/auth.store';
import { userApi } from '@/lib/api';
import {
  Zap,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button, Input } from '@autix/shared-ui';
import { useTranslations } from 'next-intl';

interface LoginForm {
  username: string;
  password: string;
}

export default function ChatLoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations('auth');

  const features = [
    { icon: BarChart3, text: t('featureAnalysis') },
    { icon: BookOpen, text: t('featureHistory') },
    { icon: Zap, text: t('featureRealtime') },
  ];

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const { data: tokens } = await userApi.post('/auth/login', data);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      const { data: profile } = await userApi.get('/auth/profile');
      setUser(profile);
      if (profile.status === 'PENDING') {
        router.push('/pending');
        return;
      }
      router.push('/chat');
    } catch (err: any) {
      setError(err.msg || err.response?.data?.msg || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
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
            <Image
              src="/logo.png"
              alt="Amux Studio"
              width={40}
              height={40}
              className="rounded-md"
              priority
            />
            <div>
              <div className="text-foreground font-bold text-xl">Amux Studio</div>
              <div className="text-foreground/60 text-xs">{t('subtitle')}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              {t('aiDrivenTitle')}<br />
              <span className="text-success">{t('requirementAnalysis')}</span> {t('assistant')}
            </h2>
            <p className="mt-3 text-foreground/60 text-sm leading-relaxed">
              {t('aiDescription')}
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
          <div className="text-foreground/40 text-xs font-mono">
            {'>'} {t('analyzeLoginPrompt')}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <Image
                src="/logo.png"
                alt="Amux Studio"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-xl font-bold text-foreground">Amux Studio</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t('startConversation')}</h1>
            <p className="text-foreground/50 text-sm">{t('loginHint')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground/80 block">
                {t('accountLabel')}
              </label>
              <Input
                id="username"
                aria-label={t('accountLabel')}
                {...register('username', { required: t('usernameRequired') })}
                placeholder={t('accountPlaceholder')}
                autoComplete="username"
                className="w-full"
              />
              {errors.username && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground/80 block">
                {t('password')}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  aria-label={t('password')}
                  type={isVisible ? 'text' : 'password'}
                  {...register('password', { required: t('passwordRequired') })}
                  placeholder={t('passwordPlaceholder')}
                  autoComplete="current-password"
                  className="w-full"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                  aria-label={isVisible ? t('hidePassword') : t('showPassword')}
                  onClick={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl p-3 text-sm" style={{ color: 'var(--danger)', backgroundColor: 'color-mix(in oklch, var(--danger) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--danger) 20%, transparent)' }} role="alert">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer font-medium"
              
              size="lg"
            >
              {loading ? t('loggingIn') : t('startChat')}
            </Button>
          </form>

          <p className="text-center text-sm text-foreground/50">
            {t('noAccount')}{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="cursor-pointer text-primary hover:underline"
            >
              {t('registerNow')}
            </button>
          </p>

          <p className="text-center text-xs text-foreground/30">
            {t('copyright')}
          </p>
        </div>
      </div>
    </div>
  );
}
