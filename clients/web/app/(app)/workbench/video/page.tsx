'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VideoWorkbenchWorkspace } from '@autix/shared-ui/workbench';
import { resolveVideoCapabilityFromModelParam } from '@autix/shared-ui/growth';
import { parseVideoDraftQuery, coerceVideoDraft } from '@autix/shared-ui/workbench';

const PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX = 'autix:public-video-draft:';

function readPublicVideoDraftMaterials(draftId: string | null) {
  if (!draftId || typeof window === 'undefined') return [];
  const storageKey = `${PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX}${draftId}`;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      materials?: Array<{
        url?: unknown;
        name?: unknown;
        sourceType?: unknown;
        sourceId?: unknown;
      }>;
    };
    if (!Array.isArray(parsed.materials)) return [];
    return parsed.materials
      .filter((item) =>
        typeof item?.url === 'string' &&
        (item.url.startsWith('data:image/') || item.url.startsWith('http://') || item.url.startsWith('https://')),
      )
      .slice(-12)
      .map((item, index) => ({
        url: item.url as string,
        name: typeof item.name === 'string' ? item.name : `Reference ${index + 1}`,
        sourceType: item.sourceType === 'image_generation' ? 'image_generation' as const : 'upload' as const,
        sourceId: typeof item.sourceId === 'string' ? item.sourceId : undefined,
      }));
  } catch {
    return [];
  }
}

export default function VideoWorkbenchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  const [initialMaterials] = useState(() => readPublicVideoDraftMaterials(draftId));
  const capability = resolveVideoCapabilityFromModelParam(searchParams.get('model'));
  const initialDraft = {
    ...coerceVideoDraft(
      parseVideoDraftQuery((k) => searchParams.get(k)),
      { resolutions: capability.resolutions },
    ),
    ...(initialMaterials.length > 0 ? { materials: initialMaterials } : {}),
  };
  const handleInitialDraftCleared = () => {
    const params = new URLSearchParams(searchParams.toString());
    ['prompt', 'duration', 'resolution', 'ratio', 'generateAudio', 'mode', 'draftId', 'source'].forEach((k) => params.delete(k));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return (
    <VideoWorkbenchWorkspace
      initialTemplateId={searchParams.get('templateId')}
      initialWorkflowTemplateId={searchParams.get('workflowTemplateId')}
      initialModelId={searchParams.get('model')}
      initialDraft={initialDraft}
      onInitialDraftCleared={handleInitialDraftCleared}
    />
  );
}
