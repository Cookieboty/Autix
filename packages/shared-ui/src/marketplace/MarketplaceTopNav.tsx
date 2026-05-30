'use client';

import { useState } from 'react';
import { Bell, Search, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../navigation';
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
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // { slug: 'skills', labelKey: 'topNavSkills' },
  // { slug: 'mcp', labelKey: 'topNavMcp' },
  { slug: 'agents', labelKey: 'topNavAgents' },
  { slug: 'image-templates', labelKey: 'topNavImage' },
  { slug: 'video-templates', labelKey: 'topNavVideo' },
];

const VALID_PUBLISH_TYPES: MarketplaceTypeSlug[] = [
  // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
  // 'skills',
  // 'mcp',
  'agents',
  'image-templates',
  'video-templates',
];

function slugToType(slug: string): MarketplaceTypeSlug {
  return (VALID_PUBLISH_TYPES as string[]).includes(slug)
    ? (slug as MarketplaceTypeSlug)
    : 'agents';
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
  const [publishOpen, setPublishOpen] = useState(false);
  const initialType = slugToType(currentSlug);

  return (
    <header className="flex h-12 items-center gap-4 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <div
        className="cursor-pointer text-base font-semibold text-foreground"
        onClick={() => nav.push('/marketplace')}
      >
        {t('topNavTitle')}
      </div>
      <nav className="flex items-center gap-1">
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
                'rounded px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-muted text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>
      <div className="ml-auto max-w-md flex-1">
        <div className="flex h-8 items-center gap-2 rounded border border-border bg-muted px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder={t('topNavSearchPlaceholder')}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch?.((e.target as HTMLInputElement).value);
            }}
          />
        </div>
      </div>
      <Button
        size="sm"
        className="cursor-pointer"
        onClick={() => setPublishOpen(true)}
      >
        <Upload className="h-4 w-4" /> {t('topNavPublish')}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-muted-foreground"
        aria-label="Notifications"
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
