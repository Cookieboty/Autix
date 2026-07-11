'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ImageWorkbenchView } from '@autix/shared-ui/workbench';
import { resolveImageCapabilityFromModelParam } from '@autix/shared-ui/growth';
import { parseImageDraftQuery, coerceImageDraft } from '@autix/shared-ui/workbench';
import type { UploadedReference } from '@autix/shared-ui/workbench';

const PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX = 'autix:public-image-draft:';

function readPublicImageDraftUploads(draftId: string | null): UploadedReference[] {
  if (!draftId || typeof window === 'undefined') return [];
  const storageKey = `${PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX}${draftId}`;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { uploadedRefs?: UploadedReference[] };
    if (!Array.isArray(parsed.uploadedRefs)) return [];
    return parsed.uploadedRefs
      .filter((ref) => typeof ref?.url === 'string' && ref.url.startsWith('data:image/'))
      .slice(-8)
      .map((ref, index) => ({
        url: ref.url,
        label: typeof ref.label === 'string' ? ref.label : 'Upload',
        annotationKey:
          typeof ref.annotationKey === 'string'
            ? ref.annotationKey
            : `public-upload:${draftId}:${index}`,
      }));
  } catch {
    return [];
  }
}

export default function ImageWorkbenchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId');
  const initialModelId = searchParams.get('model');
  const draftId = searchParams.get('draftId');
  const [initialUploadedRefs] = useState(() => readPublicImageDraftUploads(draftId));

  const capability = resolveImageCapabilityFromModelParam(initialModelId);
  const initialDraft = coerceImageDraft(
    parseImageDraftQuery((k) => searchParams.get(k)),
    {
      sizes: capability.sizes.map((s) => s.value),
      qualities: capability.qualities,
      maxCount: capability.maxCount,
    },
  );

  const handleInitialDraftCleared = () => {
    const params = new URLSearchParams(searchParams.toString());
    ['templateId', 'prompt', 'size', 'quality', 'count', 'draftId', 'source'].forEach((k) => params.delete(k));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <ImageWorkbenchView
      initialTemplateId={initialTemplateId}
      initialModelId={initialModelId}
      initialDraft={initialDraft}
      initialUploadedRefs={initialUploadedRefs}
      onInitialTemplateCleared={handleInitialDraftCleared}
      onInitialDraftApplied={handleInitialDraftCleared}
      enableMaterials
      enableQuickEstimate
      selectDefaultChatModel
    />
  );
}
