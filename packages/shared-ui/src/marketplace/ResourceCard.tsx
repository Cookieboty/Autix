'use client';

import { Heart, Eye, Monitor } from 'lucide-react';
import type {
  AnyResource,
  AgentKind,
  ResourceType,
  RuntimeReq,
} from '@autix/shared-lib';
import { FallbackImage } from '../template/FallbackImage';
import { KIND_ICON, KIND_LABEL } from '../chat/agent-kind-utils';

const TYPE_LABEL: Record<ResourceType, string> = {
  SKILL: 'Skill',
  MCP: 'MCP',
  AGENT: 'Agent',
  IMAGE_TEMPLATE: '图片模板',
  VIDEO_TEMPLATE: '视频模板',
};

const TYPE_BADGE_COLOR: Record<ResourceType, string> = {
  SKILL: '#7c3aed',
  MCP: '#0891b2',
  AGENT: '#0ea5e9',
  IMAGE_TEMPLATE: '#22c55e',
  VIDEO_TEMPLATE: '#f59e0b',
};

interface ResourceCardItem {
  id: string;
  title: string;
  category: string;
  coverImage?: string;
  useCount: number;
  likeCount: number;
  pointsCost: number;
  runtimeRequirement: RuntimeReq;
  resourceType?: ResourceType;
  kind?: AgentKind;
}

export function ResourceCard({
  resource,
  resourceType,
  onClick,
}: {
  resource: ResourceCardItem | AnyResource;
  resourceType?: ResourceType;
  onClick?: () => void;
}) {
  const r = resource as ResourceCardItem;
  const type = (r.resourceType ?? resourceType ?? 'IMAGE_TEMPLATE') as ResourceType;
  const isFree = (r.pointsCost ?? 0) === 0;
  const desktopOnly = r.runtimeRequirement === 'DESKTOP_ONLY';
  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all hover:ring-2 hover:ring-primary"
      onClick={onClick}
    >
      <div
        className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: TYPE_BADGE_COLOR[type] }}
      >
        {TYPE_LABEL[type]}
      </div>

      {desktopOnly && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-medium text-white">
          <Monitor className="h-3 w-3" /> 仅桌面端
        </div>
      )}

      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <FallbackImage
          src={r.coverImage}
          alt={r.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          fallbackText={'暂无封面'}
        />
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-sm font-medium text-foreground">{r.title}</p>
          {type === 'AGENT' && r.kind && (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {KIND_ICON[r.kind]} {KIND_LABEL[r.kind]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={
              'rounded-full px-2 py-0.5 text-[11px] ' +
              (isFree
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground')
            }
          >
            {isFree ? '免费' : `${r.pointsCost} 积分`}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" /> {r.useCount}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Heart className="h-3 w-3" /> {r.likeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
