'use client';

import { Heart, Eye, Monitor } from 'lucide-react';
import type {
  AnyResource,
  ResourceType,
  RuntimeReq,
} from '@autix/shared-lib';
import { FallbackImage } from '../template/FallbackImage';

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
      className="group relative cursor-pointer rounded-lg overflow-hidden transition-all hover:ring-2 hover:ring-[var(--accent)]"
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
      }}
      onClick={onClick}
    >
      <div
        className="absolute top-2 left-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: TYPE_BADGE_COLOR[type], color: '#fff' }}
      >
        {TYPE_LABEL[type]}
      </div>

      {desktopOnly && (
        <div
          className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#7c3aed', color: '#fff' }}
        >
          <Monitor className="w-3 h-3" /> 仅桌面端
        </div>
      )}

      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ backgroundColor: 'var(--panel-muted)' }}
      >
        <FallbackImage
          src={r.coverImage}
          alt={r.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          fallbackText={'暂无封面'}
        />
      </div>

      <div className="p-3 space-y-2">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--foreground)' }}
        >
          {r.title}
        </p>

        <div className="flex items-center gap-3">
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isFree ? '#22c55e' : 'var(--panel-muted)',
              color: isFree ? '#fff' : 'var(--muted)',
            }}
          >
            {isFree ? '免费' : `${r.pointsCost} 积分`}
          </span>
          <span className="flex-1" />
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: 'var(--muted)' }}
          >
            <Eye className="w-3 h-3" /> {r.useCount}
          </span>
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: 'var(--muted)' }}
          >
            <Heart className="w-3 h-3" /> {r.likeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
