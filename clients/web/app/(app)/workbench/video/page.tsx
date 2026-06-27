'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VideoWorkbenchWorkspace } from '@autix/shared-ui/workbench';
import { resolveVideoCapabilityFromModelParam } from '@autix/shared-ui/growth';
import { parseVideoDraftQuery, coerceVideoDraft } from '@autix/shared-ui/workbench';

export default function VideoWorkbenchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const capability = resolveVideoCapabilityFromModelParam(searchParams.get('model'));
  const initialDraft = coerceVideoDraft(
    parseVideoDraftQuery((k) => searchParams.get(k)),
    { resolutions: capability.resolutions },
  );
  const handleInitialDraftCleared = () => {
    const params = new URLSearchParams(searchParams.toString());
    ['prompt', 'duration', 'resolution', 'ratio', 'generateAudio', 'mode', 'source'].forEach((k) => params.delete(k));
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
