'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ImageWorkbenchView } from '@autix/shared-ui/workbench';

export default function ImageWorkbenchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId');
  const initialModelId = searchParams.get('model');

  const handleInitialTemplateCleared = () => {
    if (!initialTemplateId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('templateId');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <ImageWorkbenchView
      initialTemplateId={initialTemplateId}
      initialModelId={initialModelId}
      onInitialTemplateCleared={handleInitialTemplateCleared}
      enableMaterials
      enableQuickEstimate
      selectDefaultChatModel
    />
  );
}
