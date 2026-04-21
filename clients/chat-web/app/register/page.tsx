'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { registerUser } from '@/lib/api';
import { Input, Button } from '@heroui/react';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

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
      });
      router.push('/pending');
    } catch (err: any) {
      const msg = err.msg || err.response?.data?.msg;
      if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError(msg || '注册失败，请稍后重试');
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
              alt="Amux Design"
              width={40}
              height={40}
              className="rounded-md"
              priority
            />
            <div>
              <div className="text-foreground font-bold text-xl">Amux Design</div>
              <div className="text-foreground/60 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-foreground leading-tight">
            加入 Amux Design<br />
            <span className="text-success">开启智能分析</span>
          </h2>
          <p className="text-foreground/60 text-sm leading-relaxed">
            注册后，管理员将在 1 个工作日内完成审批。审批通过后即可开始使用。
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">
            {'>'} 分析用户需求结构...
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
                alt="Amux Design"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-xl font-bold text-foreground">Amux Design</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">创建账号</h1>
            <p className="text-foreground/50 text-sm">填写信息后等待管理员审批</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground/80 block">
                用户名
              </label>
              <Input
                id="username"
                aria-label="用户名"
                {...register('username', {
                  required: '请输入用户名',
                  minLength: { value: 3, message: '用户名至少 3 个字符' },
                  maxLength: { value: 20, message: '用户名最多 20 个字符' },
                })}
                placeholder="3-20 个字符"
                autoComplete="username"
                className="w-full"
                {...({ isInvalid: !!errors.username } as any)}
                errorMessage={errors.username?.message}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground/80 block">
                邮箱
              </label>
              <Input
                id="email"
                aria-label="邮箱"
                type="email"
                {...register('email', {
                  required: '请输入邮箱',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入有效的邮箱地址' },
                })}
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full"
                {...({ isInvalid: !!errors.email } as any)}
                errorMessage={errors.email?.message}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground/80 block">
                密码
              </label>
              <Input
                id="password"
                aria-label="密码"
                type={isVisible ? 'text' : 'password'}
                {...register('password', {
                  required: '请输入密码',
                  minLength: { value: 6, message: '密码至少 6 个字符' },
                })}
                placeholder="至少 6 个字符"
                autoComplete="new-password"
                className="w-full"
                {...({ isInvalid: !!errors.password } as any)}
                errorMessage={errors.password?.message}
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer"
                    aria-label={isVisible ? '隐藏密码' : '显示密码'}
                    onPress={() => setIsVisible(!isVisible)}
                  >
                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                }
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80 block">
                确认密码
              </label>
              <Input
                id="confirmPassword"
                aria-label="确认密码"
                type={isConfirmVisible ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: '请确认密码',
                  validate: (v) => v === password || '两次密码不一致',
                })}
                placeholder="再次输入密码"
                autoComplete="new-password"
                className="w-full"
                {...({ isInvalid: !!errors.confirmPassword } as any)}
                errorMessage={errors.confirmPassword?.message}
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer"
                    aria-label={isConfirmVisible ? '隐藏确认密码' : '显示确认密码'}
                    onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                  >
                    {isConfirmVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                }
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
              {loading ? '注册中...' : '注册 →'}
            </Button>
          </form>

          <p className="text-center text-sm" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
            已有账号？{' '}
            <button
              onClick={() => router.push('/login')}
              className="cursor-pointer"
              style={{ color: 'var(--accent)' }}
            >
              立即登录
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
