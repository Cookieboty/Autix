'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button, Input, Label } from '@heroui/react';
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

const features = [
  { icon: Shield, text: '统一身份认证' },
  { icon: Users, text: '细粒度权限控制' },
  { icon: Layers, text: '多系统接入' },
  { icon: Activity, text: '实时审计日志' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      setError(err.response?.data?.msg || err.response?.data?.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden
        bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700">
        {/* Grid texture overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Floating shapes */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />

        {/* Logo */}
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
              <div className="text-white/60 text-xs">Admin Console</div>
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              企业级用户权限
              <br />
              管理平台
            </h2>
            <p className="mt-3 text-white/70 text-sm leading-relaxed">
              统一管理组织内所有系统的用户、角色与权限，提升安全性与运营效率。
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

        {/* Version */}
        <div className="relative z-10">
          <span className="text-white/40 text-xs font-mono">v2.0.0</span>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
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
            <p className="text-muted-foreground text-sm mt-1">用户权限管理系统</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">欢迎回来</h1>
            <p className="text-muted-foreground text-sm">请输入您的账户凭据以继续</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                用户名
              </Label>
              <Input
                id="username"
                {...register('username', { required: '请输入用户名' })}
                placeholder="admin"
                autoComplete="username"
                size="lg"
                {...({ isInvalid: !!errors.username } as any)}
                errorMessage={errors.username?.message}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                密码
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: '请输入密码' })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  size="lg"
                  className="pr-10"
                  {...({ isInvalid: !!errors.password } as any)}
                  errorMessage={errors.password?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 rotate-45" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full cursor-pointer font-medium"
              {...({ isLoading: loading } as any)}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            © 2024 Amux Admin · 用户权限管理系统
          </p>
        </div>
      </div>
    </div>
  );
}
