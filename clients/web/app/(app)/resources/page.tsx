'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ProfileResourcesView,
  useProfileResourceRows,
} from '@autix/shared-ui/resources';
import { RESOURCE_TYPE_TO_SLUG } from '@autix/shared-ui/marketplace';
import {
  useProfileResourcesController,
  type MeTab,
  type ResourceType,
} from '@autix/shared-store';

export default function ResourcesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams?.get('tab') as MeTab) || 'acquired';
  const [tab, setTab] = useState<MeTab>(initialTab);
  const { items, loading } = useProfileResourcesController(tab, {
    page: 1,
    pageSize: 30,
  });
  const rows = useProfileResourceRows(items, tab);

  const goDetail = (resourceType: ResourceType | undefined, resourceId: string | undefined) => {
    if (!resourceType || !resourceId) return;
    const slug = RESOURCE_TYPE_TO_SLUG[resourceType];
    if (!slug) return;
    router.push(`/marketplace/${slug}/${resourceId}`);
  };

  return (
    <ProfileResourcesView
      activeTab={tab}
      rows={rows}
      loading={loading}
      onTabChange={(nextTab) => {
        setTab(nextTab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', nextTab);
        window.history.replaceState({}, '', url.toString());
      }}
      onClickRow={goDetail}
    />
  );
}
