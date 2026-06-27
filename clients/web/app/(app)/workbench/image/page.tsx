'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ImageWorkbenchView } from '@autix/shared-ui/workbench';
import { resolveImageCapabilityFromModelParam } from '@autix/shared-ui/growth';
import { parseImageDraftQuery, coerceImageDraft } from '@autix/shared-ui/workbench';

export default function ImageWorkbenchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId');
  const initialModelId = searchParams.get('model');

  const capability = resolveImageCapabilityFromModelParam(initialModelId);
  const initialDraft = coerceImageDraft(
    parseImageDraftQuery((k) => searchParams.get(k)),
    {
      sizes: capability.sizes.map((s) => s.value),
      qualities: capability.qualities.map((q) => q.value),
      maxCount: capability.maxCount,
    },
  );

  const handleInitialDraftCleared = () => {
    const params = new URLSearchParams(searchParams.toString());
    ['templateId', 'prompt', 'size', 'quality', 'count', 'source'].forEach((k) => params.delete(k));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <ImageWorkbenchView
      initialTemplateId={initialTemplateId}
      initialModelId={initialModelId}
      initialDraft={initialDraft}
      onInitialTemplateCleared={handleInitialDraftCleared}
      onInitialDraftApplied={handleInitialDraftCleared}
      enableMaterials
      enableQuickEstimate
      selectDefaultChatModel
    />
  );
}
