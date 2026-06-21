import type { MarketplaceTypeSlug, ResourceType } from '@autix/shared-store';
import { ACQUIRABLE_SLUGS } from './resource-utils';

export type PanelMode = 'web' | 'electron';

export type InstallStatus = 'not_installed' | 'missing_env' | 'ready' | 'failed';

export type ResourcePanelItem = {
  id: string;
  title?: string;
  category?: string | null;
  coverImage?: string | null;
  description?: string | null;
  pointsCost?: number;
  useCount?: number;
  viewCount?: number;
  likeCount?: number;
  runtimeRequirement?: 'CLOUD' | 'DESKTOP_ONLY' | 'EITHER';
  resourceType?: ResourceType;
  originalUrl?: string | null;
  authorName?: string | null;
  authorUrl?: string | null;
  sourcePlatform?: string | null;
  externalId?: string | null;
};

type DesktopResourcesApi = {
  install(input: {
    type: 'SKILL' | 'MCP' | 'AGENT';
    id: string;
    payload: unknown;
  }): Promise<{ ok: true; path: string }>;
  listInstalled(): Promise<
    Array<{
      type: 'SKILL' | 'MCP' | 'AGENT';
      id: string;
      path: string;
      manifest?: Record<string, unknown>;
    }>
  >;
  status?(input: {
    type: 'SKILL' | 'MCP' | 'AGENT';
    id: string;
  }): Promise<{
    status: InstallStatus;
    path?: string;
    missingEnv?: string[];
  }>;
};

export function desktopResources(): DesktopResourcesApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { amux?: { resources?: DesktopResourcesApi } }).amux?.resources;
}

export function isAcquirable(slug: MarketplaceTypeSlug) {
  return ACQUIRABLE_SLUGS.has(slug);
}

export function descriptionOf(resource: ResourcePanelItem | null) {
  return resource?.description ?? '';
}

export function pointsOf(resource: ResourcePanelItem | null) {
  return resource?.pointsCost ?? 0;
}

export function runtimeOf(resource: ResourcePanelItem | null) {
  return resource?.runtimeRequirement ?? 'CLOUD';
}

export function dispatchResourceChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
}

export async function getInstallStatus(
  resourceType: ResourceType,
  resourceId: string,
): Promise<InstallStatus> {
  const resources = desktopResources();
  if (!resources) return 'not_installed';
  try {
    if (resourceType !== 'IMAGE_TEMPLATE' && resourceType !== 'VIDEO_TEMPLATE' && resources.status) {
      const res = await resources.status({
        type: resourceType as 'SKILL' | 'MCP' | 'AGENT',
        id: resourceId,
      });
      return res.status;
    }
    const installed = await resources.listInstalled();
    const item = installed.find((it) => it.type === resourceType && it.id === resourceId);
    if (!item) return 'not_installed';
    const manifest = item.manifest as { envSchema?: Record<string, string> } | undefined;
    const envSchema = manifest?.envSchema;
    if (envSchema && Object.keys(envSchema).length > 0) return 'missing_env';
    return 'ready';
  } catch {
    return 'failed';
  }
}
