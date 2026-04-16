'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Shield,
  Key,
  TrendingUp,
  Menu,
  Layers,
  Activity,
  Clock,
  ArrowRight,
  UserPlus,
  ShieldPlus,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Card, CardHeader, CardContent } from '@heroui/react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Stats {
  users: number;
  roles: number;
  permissions: number;
  systems: number;
  menus: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [users, roles, permissions, systems, menus] = await Promise.all([
        api.get('/users').then(res => (res.data as any)?.pagination?.total ?? 0),
        api.get('/roles').then(res => (res.data as any)?.list?.length ?? (res.data as any)?.length ?? 0),
        api.get('/permissions').then(res => (res.data as any)?.list?.length ?? (res.data as any)?.length ?? 0),
        api.get('/systems').then(res => (res.data as any)?.list?.length ?? (res.data as any)?.length ?? 0),
        api.get('/menus').then(res => (res.data as any)?.list?.length ?? (res.data as any)?.length ?? 0),
      ]);
      return { users, roles, permissions, systems, menus };
    },
  });

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const quickActions = [
    { icon: UserPlus, label: '新增用户', path: '/users', iconColor: 'var(--accent)' },
    { icon: ShieldPlus, label: '新增角色', path: '/roles', iconColor: 'var(--success)' },
    { icon: Key, label: '权限配置', path: '/permission-center', iconColor: 'var(--warning)' },
  ];

  const statCards = [
    {
      label: '用户总数',
      value: stats?.users || 0,
      icon: Users,
      iconColor: 'var(--accent)',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: '角色数量',
      value: stats?.roles || 0,
      icon: Shield,
      iconColor: 'var(--success)',
      trend: '+2',
      trendUp: true,
    },
    {
      label: '权限数量',
      value: stats?.permissions || 0,
      icon: Key,
      iconColor: 'var(--warning)',
      trend: '+8',
      trendUp: true,
    },
    {
      label: '系统数量',
      value: stats?.systems || 0,
      icon: Layers,
      iconColor: 'var(--danger)',
      trend: '稳定',
      trendUp: true,
    },
    {
      label: '菜单数量',
      value: stats?.menus || 0,
      icon: Menu,
      iconColor: 'var(--muted)',
      trend: '+3',
      trendUp: true,
    },
  ];

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-default-100">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}，{user?.realName || user?.username}
            </h1>
            <p className="text-sm text-default-500 mt-0.5">
              欢迎回到 Autix 用户管理系统
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-mono font-bold">
            {currentTime.toLocaleTimeString('zh-CN')}
          </div>
          <div className="text-sm text-default-500">
            {currentTime.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((stat) => (
          <Card 
            key={stat.label}
            className="group transition-transform hover:-translate-y-1 shadow-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-default-500 mb-2">{stat.label}</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-4xl font-bold">
                      {isLoading ? '-' : stat.value}
                    </p>
                    {stat.trend && (
                      <Chip
                        variant="soft"
                        color={stat.trendUp ? 'success' : 'danger'}
                        size="sm"
                        className="font-mono"
                      >
                        {stat.trendUp && <TrendingUp className="h-3 w-3 mr-1 inline" />}
                        {stat.trend}
                      </Chip>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-default-100 transition-transform group-hover:scale-110 flex-shrink-0">
                  <stat.icon className="h-5 w-5" style={{ color: stat.iconColor }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}</div>

      {/* Quick Actions & System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">快捷操作</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.path)}
                  className="group relative flex flex-col items-center gap-3 p-5 rounded-xl border border-default-200 hover:bg-default-100 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                >
                  <div className="p-3 rounded-xl bg-default-100 transition-transform duration-200 group-hover:scale-110">
                    <action.icon className="h-5 w-5" style={{ color: action.iconColor }} />
                  </div>
                  <span className="text-xs font-medium">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-default-400" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">系统状态</h2>
            </div>
            <div className="space-y-2">
              {[
                { icon: null, dot: true, label: '服务状态', value: '运行中' },
                { icon: Clock, dot: false, label: '运行时长', value: '24小时 18分' },
                { icon: Users, dot: false, label: '在线用户', value: `${stats?.users || 0} 人` },
                { icon: Shield, dot: false, label: '系统版本', value: 'v2.0.0' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 rounded-xl bg-default-100"
                >
                  <div className="flex items-center gap-3">
                    {item.dot ? (
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    ) : item.icon ? (
                      <item.icon className="h-4 w-4 text-default-400" />
                    ) : null}
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-mono text-default-500">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <RecentActivitySection />
    </div>
  );
}

function RecentActivitySection() {
  const router = useRouter();
  const { data: recentUsers, isLoading } = useQuery({
    queryKey: ['recent-users'],
    queryFn: () => api.get('/users?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc').then(res => res.data.list),
  });

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  };

  const activityItems: Array<{ user: string; action: string; target: string; time: string; icon: typeof UserPlus; iconColor: string }> = (recentUsers || []).map((u: { realName: string; username: string; createdAt: string }) => ({
    user: u.realName || u.username,
    action: '创建了用户',
    target: u.realName || u.username,
    time: getRelativeTime(u.createdAt),
    icon: UserPlus,
    iconColor: 'var(--accent)',
  }));

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-default-400" />
            <h2 className="text-base font-semibold">最近活动</h2>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl animate-pulse bg-default-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activityItems.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-default-400" />
            <h2 className="text-base font-semibold">最近活动</h2>
          </div>
          <div className="text-sm text-default-500 text-center py-4">暂无活动记录</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-default-400" />
            <h2 className="text-base font-semibold">最近活动</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-sm text-primary"
            onClick={() => router.push('/users')}
          >
            查看全部
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        <div className="space-y-2">
          {activityItems.map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-default-100 transition-colors cursor-pointer"
            >
              <div className="p-2 rounded-lg flex-shrink-0 bg-default-100">
                <activity.icon className="h-4 w-4" style={{ color: activity.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user}</span>
                  {' '}{activity.action}{' '}
                  <span className="font-medium text-primary">{activity.target}</span>
                </p>
                <p className="text-xs text-default-400 mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
