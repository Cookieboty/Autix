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
import { Input, Button } from '@heroui/react';

interface LoginForm {
  username: string;
  password: string;
}

const features = [
  { icon: BarChart3, text: '需求结构化分析' },
  { icon: BookOpen, text: '多会话历史管理' },
  { icon: Zap, text: '实时响应，低延迟' },
];

export default function ChatLoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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
      router.push('/');
    } catch (err: any) {
      setError(err.msg || err.response?.data?.msg || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-background to-secondary">
        {/* Animated particle dots */}
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

        {/* Logo */}
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

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              AI 驱动的<br />
              <span className="text-success">需求分析</span> 助理
            </h2>
            <p className="mt-3 text-foreground/60 text-sm leading-relaxed">
              通过自然语言对话，帮您快速完成需求结构化、方案评审与文档生成。
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

        {/* Bottom text */}
        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">
            {'>'} 分析用户登录功能需求...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
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

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">开始对话</h1>
            <p className="text-foreground/50 text-sm">登录以使用 AI 智能助理</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground/80 block">
                账号
              </label>
              <Input
                id="username"
                aria-label="账号"
                {...register('username', { required: '请输入用户名' })}
                placeholder="输入您的账号"
                autoComplete="username"
                className="w-full"
                {...({ isInvalid: !!errors.username } as any)}
                errorMessage={errors.username?.message}
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
                {...register('password', { required: '请输入密码' })}
                placeholder="输入您的密码"
                autoComplete="current-password"
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
              {loading ? '登录中...' : '开始对话 →'}
            </Button>
          </form>

          <p className="text-center text-sm text-foreground/50">
            没有账号？{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="cursor-pointer text-primary hover:underline"
            >
              立即注册
            </button>
          </p>

          <p className="text-center text-xs text-foreground/30">
            © 2024 Amux Design · 需求分析助理
          </p>
        </div>
      </div>
    </div>
  );
}
