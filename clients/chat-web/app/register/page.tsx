'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { MessageSquare, Eye, EyeOff } from 'lucide-react';
import { registerUser } from '@/lib/api';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      const msg = err.response?.data?.message;
      if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError(msg || '注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(30,27,75,0.8)',
    border: '1px solid rgba(99,102,241,0.3)',
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F0F23 0%, #1E1B4B 50%, #312E81 100%)' }}
      >
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
        <div
          className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.3) 0%, transparent 70%)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(67,56,202,0.4)', border: '1px solid rgba(99,102,241,0.5)' }}
            >
              <MessageSquare className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="text-white font-bold text-xl">Autix AI</div>
              <div className="text-indigo-300 text-xs">智能需求分析助理</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-white leading-tight">
            加入 Autix AI
            <br />
            <span style={{ color: '#22C55E' }}>开启智能分析</span>
          </h2>
          <p className="text-indigo-200/70 text-sm leading-relaxed">
            注册后，管理员将在 1 个工作日内完成审批。审批通过后即可开始使用。
          </p>
        </div>

        <div className="relative z-10">
          <div className="text-indigo-300/40 text-xs font-mono">
            &gt; 分析用户需求结构...
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#1a1a2e' }}>
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-400" />
              <span className="text-xl font-bold text-white">Autix AI</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">创建账号</h1>
            <p className="text-indigo-200/50 text-sm">填写信息后等待管理员审批</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">用户名</label>
              <input
                {...register('username', {
                  required: '请输入用户名',
                  minLength: { value: 3, message: '用户名至少 3 个字符' },
                  maxLength: { value: 20, message: '用户名最多 20 个字符' },
                })}
                placeholder="3-20 个字符"
                autoComplete="username"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
              />
              {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">邮箱</label>
              <input
                {...register('email', {
                  required: '请输入邮箱',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入有效的邮箱地址' },
                })}
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: '请输入密码',
                    minLength: { value: 6, message: '密码至少 6 个字符' },
                  })}
                  placeholder="至少 6 个字符"
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
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
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-indigo-100/80 block">确认密码</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  {...register('confirmPassword', {
                    required: '请确认密码',
                    validate: (v) => v === password || '两次密码不一致',
                  })}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white placeholder:text-indigo-300/40 outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.8)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'rgba(165,180,252,0.5)' }}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
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
                  注册中...
                </>
              ) : (
                '注册 →'
              )}
            </button>
          </form>

          <p className="text-center text-sm" style={{ color: 'rgba(165,180,252,0.5)' }}>
            已有账号？{' '}
            <button
              onClick={() => router.push('/login')}
              className="cursor-pointer underline"
              style={{ color: 'rgba(99,102,241,0.8)' }}
            >
              立即登录
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
