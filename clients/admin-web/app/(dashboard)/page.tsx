'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Building, 
  Shield, 
  Key, 
  TrendingUp, 
  Settings,
  Menu,
  Layers,
  Activity,
  Clock,
  ArrowRight,
  Plus,
  UserPlus,
  ShieldPlus,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Stats {
  users: number;
  departments: number;
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
      const [users, departments, roles, permissions, systems, menus] = await Promise.all([
        api.get('/users').then(res => res.data.length),
        api.get('/departments').then(res => res.data.length),
        api.get('/roles').then(res => res.data.length),
        api.get('/permissions').then(res => res.data.length),
        api.get('/systems').then(res => res.data.length),
        api.get('/menus').then(res => res.data.length),
      ]);
      return { users, departments, roles, permissions, systems, menus };
    },
  });

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const quickActions = [
    { icon: UserPlus, label: '新增用户', path: '/users', color: 'bg-purple-500' },
    { icon: ShieldPlus, label: '新增角色', path: '/roles', color: 'bg-blue-500' },
    { icon: Plus, label: '新增部门', path: '/departments', color: 'bg-orange-500' },
    { icon: Settings, label: '系统配置', path: '/systems', color: 'bg-cyan-500' },
  ];

  const statCards = [
    {
      label: '用户总数',
      value: stats?.users || 0,
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: '部门数量',
      value: stats?.departments || 0,
      icon: Building,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      trend: '+5%',
      trendUp: true,
    },
    {
      label: '角色数量',
      value: stats?.roles || 0,
      icon: Shield,
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+2',
      trendUp: true,
    },
    {
      label: '权限数量',
      value: stats?.permissions || 0,
      icon: Key,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: '+8',
      trendUp: true,
    },
    {
      label: '系统数量',
      value: stats?.systems || 0,
      icon: Layers,
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-50',
      iconColor: 'text-cyan-600',
      trend: '稳定',
      trendUp: true,
    },
    {
      label: '菜单数量',
      value: stats?.menus || 0,
      icon: Menu,
      color: 'from-teal-500 to-green-500',
      bgColor: 'bg-teal-50',
      iconColor: 'text-teal-600',
      trend: '+3',
      trendUp: true,
    },
  ];

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {getGreeting()}，{user?.realName || user?.username} 👋
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                欢迎回到 Autix 用户管理系统
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-gray-900">
            {currentTime.toLocaleTimeString('zh-CN')}
          </div>
          <div className="text-sm text-gray-500">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={stat.label}
            className="relative group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            
            {/* Content */}
            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-2">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-gray-900">
                      {isLoading ? '-' : stat.value}
                    </p>
                    {stat.trend && (
                      <Badge 
                        variant="outline" 
                        className={`${
                          stat.trendUp 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        } font-mono text-xs`}
                      >
                        {stat.trendUp && <TrendingUp className="h-3 w-3 mr-1 inline" />}
                        {stat.trend}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                </div>
              </div>
            </div>

            {/* Decorative Element */}
            <div className={`absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 rounded-full blur-2xl`} />
          </div>
        ))}
      </div>

      {/* Quick Actions & System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">快捷操作</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.path)}
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`${action.color} p-4 rounded-xl text-white group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {action.label}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-5 w-5" />
            <h2 className="text-lg font-semibold">系统状态</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-medium">服务状态</span>
              </div>
              <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                运行中
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4" />
                <span className="font-medium">运行时长</span>
              </div>
              <span className="text-sm font-mono">24小时 18分</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4" />
                <span className="font-medium">在线用户</span>
              </div>
              <span className="text-sm font-mono">{stats?.users || 0} 人</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4" />
                <span className="font-medium">系统版本</span>
              </div>
              <span className="text-sm font-mono">v2.0.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity (Placeholder) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">最近活动</h2>
          </div>
          <Button variant="ghost" size="sm" className="cursor-pointer text-purple-600 hover:text-purple-700">
            查看全部
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="space-y-4">
          {[
            { user: '张三', action: '创建了新用户', target: '李四', time: '5分钟前', icon: UserPlus, color: 'bg-purple-100 text-purple-600' },
            { user: '管理员', action: '更新了角色权限', target: '系统管理员', time: '1小时前', icon: Shield, color: 'bg-blue-100 text-blue-600' },
            { user: '王五', action: '修改了部门信息', target: '技术部', time: '3小时前', icon: Building, color: 'bg-orange-100 text-orange-600' },
          ].map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className={`${activity.color} p-2 rounded-lg`}>
                <activity.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.user}</span>
                  {' '}{activity.action}{' '}
                  <span className="font-medium text-purple-600">{activity.target}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
