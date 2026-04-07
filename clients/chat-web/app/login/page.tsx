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
  { icon: MessageSquare, text: '流式 AI 对话' },
  { icon: BarChart3, text: '需求结构化分析' },
  { icon: BookOpen, text: '多会话历史管理' },
  { icon: Zap, text: '实时响应，低延迟' },
];

export default function ChatLoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F0F23 0%, #1E1B4B 50%, #312E81 100%)' }}
      >
        {/* Animated particle dots */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-indigo-400/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>
        {/* Gradient orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.3) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(67,56,202,0.4)', border: '1px solid rgba(99,102,241,0.5)' }}>
              <MessageSquare className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Autix AI</div>
              <div className="text-indigo-300 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              AI 驱动的
              <br />
              <span style={{ color: '#22C55E' }}>需求分析</span> 助理
            </h2>
            <p className="mt-3 text-indigo-200/70 text-sm leading-relaxed">
              通过自然语言对话，帮您快速完成需求结构化、方案评审与文档生成。
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(67,56,202,0.3)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                <span className="text-indigo-100/80 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typing demo */}
        <div className="relative z-10">
          <div className="text-indigo-300/40 text-xs font-mono">
            &gt; 分析用户登录功能需求...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: '#1a1a2e' }}
      >
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
            <p className="text-indigo-300/60 text-sm mt-1">智能需求分析助理</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">开始对话</h1>
            <p className="text-indigo-200/50 text-sm">登录以使用 AI 智能助理</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-indigo-100/80 block">
                账号
              </label>
              <input
                id="username"
                {...register('username', { required: '请输入用户名' })}
                placeholder="输入您的账号"
                autoComplete="username"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                style={{
                  background: 'rgba(30,27,75,0.8)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
              />
              {errors.username && (
                <p className="text-xs text-red-400">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-indigo-100/80 block">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: '请输入密码' })}
                  placeholder="输入您的密码"
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                  style={{
                    background: 'rgba(30,27,75,0.8)',
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'rgba(165,180,252,0.5)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div
                className="rounded-xl p-3 text-sm text-red-300 border"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-medium text-sm cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? '#16a34a' : '#22C55E', color: '#000' }}
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

          <p className="text-center text-xs" style={{ color: 'rgba(165,180,252,0.3)' }}>
            © 2024 Autix AI · 需求分析助理
          </p>
        </div>
      </div>
    </div>
  );
}
