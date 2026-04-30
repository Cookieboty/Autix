'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { registerUser } from '@/lib/api';
import { Input, Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  inviteCode: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('aff') || '';
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
  } = useForm<RegisterForm>();

  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      await registerUser({
        username: data.username,
        email: data.email,
        password: data.password,
        systemCode: 'chat',
        inviteCode: data.inviteCode || undefined,
      });
      router.push('/pending');
    } catch (err: any) {
      const msg = err.msg || err.response?.data?.msg;
      if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError(msg || t('registerFailed'));
      }
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

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-foreground leading-tight">
            {t('joinTitle')}<br />
            <span className="text-success">{t('startSmartAnalysis')}</span>
          </h2>
          <p className="text-foreground/60 text-sm leading-relaxed">
            {t('registerDescription')}
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">
            {'>'} {t('analyzeStructurePrompt')}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
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

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">{t('createAccount')}</h1>
            <p className="text-foreground/50 text-sm">{t('registerHint')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground/80 block">
                {t('username')}
              </label>
              <Input
                id="username"
                aria-label={t('username')}
                {...register('username', {
                  required: t('usernameRequired'),
                  minLength: { value: 3, message: t('usernameMinLength') },
                  maxLength: { value: 20, message: t('usernameMaxLength') },
                })}
                placeholder={t('usernamePlaceholder')}
                autoComplete="username"
                className="w-full"
              />
              {errors.username && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground/80 block">
                {t('email')}
              </label>
              <Input
                id="email"
                aria-label={t('email')}
                type="email"
                {...register('email', {
                  required: t('emailRequired'),
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('emailInvalid') },
                })}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                className="w-full"
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.email.message}</p>
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
                  {...register('password', {
                    required: t('passwordRequired'),
                    minLength: { value: 6, message: t('passwordMinLength') },
                  })}
                  placeholder={t('passwordCharPlaceholder')}
                  autoComplete="new-password"
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

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80 block">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  aria-label={t('confirmPassword')}
                  type={isConfirmVisible ? 'text' : 'password'}
                  {...register('confirmPassword', {
                    required: t('confirmPasswordRequired'),
                    validate: (v) => v === password || t('passwordMismatch'),
                  })}
                  placeholder={t('confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  className="w-full"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                  aria-label={isConfirmVisible ? t('hideConfirmPassword') : t('showConfirmPassword')}
                  onClick={() => setIsConfirmVisible(!isConfirmVisible)}
                >
                  {isConfirmVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inviteCode" className="text-sm font-medium text-foreground/80 block">
                {t('inviteCodeLabel')}
              </label>
              <Input
                id="inviteCode"
                aria-label={t('inviteCodeLabel')}
                {...register('inviteCode')}
                defaultValue={refCode}
                placeholder={t('inviteCodePlaceholder')}
                className="w-full"
              />
            </div>

            {error && (
              <div className="rounded-xl p-3 text-sm" style={{ color: 'var(--danger)', backgroundColor: 'color-mix(in oklch, var(--danger) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--danger) 20%, transparent)' }} role="alert">
                {error}
              </div>
            )}

            <Button
              type="submit"
              isDisabled={loading}
              className="w-full cursor-pointer font-medium"
              variant="primary"
              size="lg"
            >
              {loading ? t('registering') : t('registerButton')}
            </Button>
          </form>

          <p className="text-center text-sm" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
            {t('hasAccount')}{' '}
            <button
              onClick={() => router.push('/login')}
              className="cursor-pointer"
              style={{ color: 'var(--accent)' }}
            >
              {t('loginNow')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
