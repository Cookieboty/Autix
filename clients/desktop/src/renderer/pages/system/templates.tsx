import { AdminTemplatesView } from '@autix/shared-ui/admin';

export function SystemTemplatesPage() {
  return <AdminTemplatesView defaultResourceType="image-templates" resourceTypes={['image-templates']} />;
}
