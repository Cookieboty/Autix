import type { LucideIcon } from 'lucide-react';
import { Film, Image as ImageIcon, MessageSquare } from 'lucide-react';

export type KindKey = 'chat' | 'video' | 'image' | 'avatar';

export interface ChatSidebarViewSwitcher {
  currentId: string;
  views: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
  }>;
  onSwitch: (id: string) => void;
}

export interface ChatSidebarNavItemLike {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
  action?: () => void;
}

export interface ChatSidebarSessionListItem {
  id: string;
  title: string;
  kind?: KindKey;
  agentName?: string | null;
  projectMeta?: {
    projectId: string;
    status: string;
    clipCount: number;
  } | null;
}

export function KindBadge({ kind, label }: { kind: KindKey; label: string }) {
  const Icon =
    kind === 'video'
      ? Film
      : kind === 'image'
        ? ImageIcon
        : MessageSquare;
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary"
      aria-label={label}
      title={label}
    >
      <Icon className="h-3 w-3 text-muted-foreground" />
    </span>
  );
}
