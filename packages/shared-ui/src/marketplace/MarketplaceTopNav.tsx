'use client';

import { useState } from 'react';
import { Bell, Search, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../navigation';
import { useAuthStore } from '@autix/shared-store';
import type { MarketplaceTypeSlug } from '@autix/shared-lib';
import { PublishDrawer } from './forms/PublishDrawer';
import { SidebarTrigger } from '../ui/sidebar';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

const TYPES: {
  slug: string;
  labelKey:
    | 'topNavHome'
    | 'topNavSkills'
    | 'topNavMcp'
    | 'topNavAgents'
    | 'topNavImage'
    | 'topNavVideo';
}[] = [
  { slug: '', labelKey: 'topNavHome' },
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // { slug: 'skills', labelKey: 'topNavSkills' },
  // { slug: 'mcp', labelKey: 'topNavMcp' },
  // { slug: 'agents', labelKey: 'topNavAgents' },
  { slug: 'image-templates', labelKey: 'topNavImage' },
  { slug: 'video-templates', labelKey: 'topNavVideo' },
];

const VALID_PUBLISH_TYPES: MarketplaceTypeSlug[] = [
  // 暂时移除 mcp、skills、agents 模板，专注图片与视频模板
  // 'skills',
  // 'mcp',
  // 'agents',
  'image-templates',
  'video-templates',
];

function slugToType(slug: string): MarketplaceTypeSlug {
  return (VALID_PUBLISH_TYPES as string[]).includes(slug)
    ? (slug as MarketplaceTypeSlug)
    : 'image-templates';
}

export function MarketplaceTopNav({
  currentSlug = '',
  onSearch,
  onPublished,
}: {
  currentSlug?: string;
  onSearch?: (q: string) => void;
  onPublished?: (type: MarketplaceTypeSlug) => void;
}) {
  const nav = useRouter();
  const t = useTranslations('publish');
  const tSidebar = useTranslations('sidebar');
  const [publishOpen, setPublishOpen] = useState(false);
  const initialType = slugToType(currentSlug);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-[linear-gradient(90deg,rgba(2,6,23,0.9),rgba(8,17,31,0.82))] px-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <SidebarTrigger className="-ml-1 text-white/70 hover:bg-white/10 hover:text-white" />
      <div
        className="cursor-pointer whitespace-nowrap text-base font-semibold text-white"
        onClick={() => nav.push('/marketplace')}
      >
        {t('topNavTitle')}
      </div>
      <nav className="hidden items-center gap-1 md:flex">
        {TYPES.map((item) => {
          const active =
            currentSlug === item.slug ||
            (item.slug === '' && (currentSlug === '' || currentSlug === 'home'));
          return (
            <button
              key={item.slug || 'home'}
              onClick={() =>
                nav.push(item.slug ? `/marketplace/${item.slug}` : '/marketplace')
              }
              className={cn(
                'rounded-full px-3 py-1.5 text-sm transition-all',
                active
                  ? 'bg-white text-slate-950 shadow-[0_8px_24px_rgba(14,165,233,0.16)]'
                  : 'text-white/58 hover:bg-white/10 hover:text-white',
              )}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>
      <div className="ml-auto min-w-0 max-w-md flex-1">
        <div className="flex h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[0.075] px-3 backdrop-blur-md">
          <Search className="h-4 w-4 text-white/48" />
          <input
            placeholder={t('topNavSearchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch?.((e.target as HTMLInputElement).value);
            }}
          />
        </div>
      </div>
      <Button
        size="sm"
        className="cursor-pointer rounded-full bg-white text-slate-950 hover:bg-white/88"
        onClick={() => {
          if (!isAuthenticated) {
            nav.push('/login');
            return;
          }
          setPublishOpen(true);
        }}
      >
        <Upload className="h-4 w-4" /> {t('topNavPublish')}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="hidden text-white/58 hover:bg-white/10 hover:text-white sm:inline-flex"
        aria-label={tSidebar('notifications')}
      >
        <Bell className="h-4 w-4" />
      </Button>

      <PublishDrawer
        open={publishOpen}
        initialType={initialType}
        onClose={() => setPublishOpen(false)}
        onSaved={(type) => {
          onPublished?.(type);
          nav.push(`/marketplace/${type}`);
        }}
      />
    </header>
  );
}
