import type React from 'react';
import { FolderOpen, History, LayoutTemplate } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '../../../ui/utils';
import type { VideoInspirationTab } from '../constants';

export function VideoInspirationTabs({
  tab,
  onTabChange,
}: {
  tab: VideoInspirationTab;
  onTabChange: (tab: VideoInspirationTab) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet');

  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
      <InspirationTabButton active={tab === 'history'} icon={<History className="size-3.5" />} onClick={() => onTabChange('history')}>
        {t('tabs.history')}
      </InspirationTabButton>
      <InspirationTabButton active={tab === 'materials'} icon={<FolderOpen className="size-3.5" />} onClick={() => onTabChange('materials')}>
        {t('tabs.materials')}
      </InspirationTabButton>
      <InspirationTabButton active={tab === 'templates'} icon={<LayoutTemplate className="size-3.5" />} onClick={() => onTabChange('templates')}>
        {t('tabs.templates')}
      </InspirationTabButton>
    </div>
  );
}

function InspirationTabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
