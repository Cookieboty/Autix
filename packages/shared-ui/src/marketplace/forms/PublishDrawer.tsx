'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Wrench,
  Bot,
  ImageIcon,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MarketplaceTypeSlug } from '@autix/shared-lib';
import {
  DrawerShell,
  DrawerHero,
  DrawerFooterRow,
} from '../../drawer-shell';
import { ImageTemplateForm } from './ImageTemplateForm';
import { VideoTemplateForm } from './VideoTemplateForm';
import { SkillForm } from './SkillForm';
import { McpForm } from './McpForm';
import { AgentForm } from './AgentForm';

interface TypeOption {
  slug: MarketplaceTypeSlug;
  labelKey: 'tabSkill' | 'tabMcp' | 'tabAgent' | 'tabImage' | 'tabVideo';
  icon: LucideIcon;
  color: string;
}

const TYPES: TypeOption[] = [
  { slug: 'skills', labelKey: 'tabSkill', icon: Sparkles, color: '#7c3aed' },
  { slug: 'mcp', labelKey: 'tabMcp', icon: Wrench, color: '#0891b2' },
  { slug: 'agents', labelKey: 'tabAgent', icon: Bot, color: '#0ea5e9' },
  { slug: 'image-templates', labelKey: 'tabImage', icon: ImageIcon, color: '#22c55e' },
  { slug: 'video-templates', labelKey: 'tabVideo', icon: Video, color: '#f59e0b' },
];

export interface PublishDrawerProps {
  open: boolean;
  initialType?: MarketplaceTypeSlug;
  onClose: () => void;
  onSaved?: (type: MarketplaceTypeSlug) => void;
}

export function PublishDrawer({
  open,
  initialType = 'skills',
  onClose,
  onSaved,
}: PublishDrawerProps) {
  const t = useTranslations('publish');
  const [activeType, setActiveType] = useState<MarketplaceTypeSlug>(initialType);

  // Reset to initialType every time the drawer is opened.
  useEffect(() => {
    if (open) setActiveType(initialType);
  }, [open, initialType]);

  const handleSaved = () => {
    onSaved?.(activeType);
    onClose();
  };

  const types = useMemo(
    () => TYPES.map((it) => ({ ...it, label: t(it.labelKey) })),
    [t],
  );

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width="2xl"
      header={
        <DrawerHero
          eyebrow={t('drawerEyebrow')}
          title={t('drawerTitle')}
          description={t('drawerDescription')}
          meta={
            <span
              className="text-[10.5px] font-medium uppercase tracking-[0.06em]"
              style={{ color: 'var(--muted)' }}
            >
              {types.find((tt) => tt.slug === activeType)?.label}
            </span>
          }
        />
      }
      footer={
        <DrawerFooterRow
          aside={t('drawerFooterAside')}
          actions={null}
        />
      }
    >
      <div
        className="sticky top-0 z-10 px-6 pt-3 pb-3 flex gap-2 overflow-x-auto"
        style={{
          backgroundColor: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {types.map((it) => {
          const Icon = it.icon;
          const active = activeType === it.slug;
          return (
            <button
              key={it.slug}
              type="button"
              onClick={() => setActiveType(it.slug)}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: active ? it.color : 'var(--panel-muted)',
                color: active ? '#fff' : 'var(--muted)',
                border: '1px solid',
                borderColor: active ? it.color : 'var(--border)',
              }}
            >
              <Icon className="w-3.5 h-3.5" /> {it.label}
            </button>
          );
        })}
      </div>

      {/* Each form is independently mounted; switching tabs resets state. */}
      {activeType === 'skills' && (
        <SkillForm key="skill" onSaved={handleSaved} />
      )}
      {activeType === 'mcp' && <McpForm key="mcp" onSaved={handleSaved} />}
      {activeType === 'agents' && (
        <AgentForm key="agent" onSaved={handleSaved} />
      )}
      {activeType === 'image-templates' && (
        <ImageTemplateForm key="image" onSaved={handleSaved} />
      )}
      {activeType === 'video-templates' && (
        <VideoTemplateForm key="video" onSaved={handleSaved} />
      )}
    </DrawerShell>
  );
}
