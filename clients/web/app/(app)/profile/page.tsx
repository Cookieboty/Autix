'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  SidebarTrigger,
} from '@autix/shared-ui/ui';
import { marketplaceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useTranslations } from 'next-intl';

interface PlatformStats {
  totalResources: number;
  bySkillCount: number;
  byMcpCount: number;
  byAgentCount: number;
  byImageTemplateCount: number;
  byVideoTemplateCount: number;
  totalAcquisitions: number;
}

export default function ProfilePage() {
  const t = useTranslations('profile.resources');
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    marketplaceApi.platformStats().then((res) => {
      setStats(res.data as PlatformStats);
    });
  }, []);

  const nickname = user?.realName || user?.username || t('notLoggedIn');
  const initial = (nickname[0] || '?').toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="ml-1 text-sm font-semibold text-foreground">{t('profileTitle')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Card>
          <CardContent className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              {user?.avatar && <AvatarImage src={user.avatar} alt={nickname} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-foreground">{nickname}</div>
              <div className="mt-1 text-xs text-muted-foreground">{user?.email ?? '—'}</div>
            </div>
            <div className="flex items-center gap-6 text-center">
              <div>
                <div className="text-base font-semibold text-foreground">{stats?.totalResources ?? 0}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t('stats.publishedResources')}</div>
              </div>
              <div>
                <div className="text-base font-semibold text-foreground">{stats?.totalAcquisitions ?? 0}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t('stats.platformFavorites')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
