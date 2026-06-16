'use client';

import { useSearchParams } from 'next/navigation';
import { VideoWorkbenchWorkspace } from '@autix/shared-ui/workbench';

export default function VideoWorkbenchPage() {
  const searchParams = useSearchParams();
  return (
    <VideoWorkbenchWorkspace
      initialTemplateId={searchParams.get('templateId')}
      initialWorkflowTemplateId={searchParams.get('workflowTemplateId')}
    />
  );
}
