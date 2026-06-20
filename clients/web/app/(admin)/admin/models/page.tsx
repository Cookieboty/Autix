'use client';

import { AdminSystemModelsView } from '@autix/shared-ui/admin';
import { AMUX_API_URL } from '@/lib/constants';

export default function AdminSystemModelsPage() {
  return <AdminSystemModelsView defaultAmuxHost={AMUX_API_URL} />;
}
