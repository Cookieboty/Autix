'use client';

import { AdminTemplatesView } from '@autix/shared-ui/admin';

export default function AdminTemplatesPage() {
  return (
    <AdminTemplatesView
      defaultResourceType="image-templates"
      resourceTypes={['image-templates', 'video-templates']}
      capabilities={{
        resourceSwitcher: true,
        batchActions: true,
        hot: true,
      }}
      />
  );
}
