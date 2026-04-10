'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/auth.store';
import { userApi } from '@/lib/api';
import {
  MessageSquare,
  Zap,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
} from 'lucide-react';

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20 border border-primary/30">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Autix AI</div>
              <div className="text-foreground/60 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
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
              <MessageSquare className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">开始对话</h1>
            <p className="text-foreground/50 text-sm">登录以使用 AI 智能助理</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground/80 block">
                账号
              </label>
              <input
                id="username"
                {...register('username', { required: '请输入用户名' })}
                placeholder="输入您的账号"
                autoComplete="username"
                className="w-full h-12 px-4 rounded-xl text-sm text-foreground placeholder:text-foreground/30 bg-secondary border border-border outline-none transition-colors focus:border-primary"
              />
              {errors.username && (
                <p className="text-xs text-danger">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground/80 block">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={isVisible ? 'text' : 'password'}
                  {...register('password', { required: '请输入密码' })}
                  placeholder="输入您的密码"
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-10 rounded-xl text-sm text-foreground placeholder:text-foreground/30 bg-secondary border border-border outline-none transition-colors focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setIsVisible(!isVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl p-3 text-sm text-danger bg-danger/10 border border-danger/20" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-medium text-sm cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-success text-success-foreground hover:bg-success/90"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                '开始对话 →'
              )}
            </button>
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
            © 2024 Autix AI · 需求分析助理
          </p>
        </div>
      </div>
    </div>
  );
}
