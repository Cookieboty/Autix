'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
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

  const PAGE_SIZE = 30;
  const initialTab = (searchParams?.get('tab') as MeTab) || 'generations';
  const [tab, setTab] = useState<MeTab>(initialTab);
  const [page, setPage] = useState(1);
  const { items, total, isInitialLoading } = useProfileResourcesController(tab, {
    page,
    pageSize: PAGE_SIZE,
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
      loading={isInitialLoading}
      pagination={{ page, pageSize: PAGE_SIZE, total }}
      onPageChange={setPage}
      onTabChange={(nextTab) => {
        setTab(nextTab);
        setPage(1);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', nextTab);
        window.history.replaceState({}, '', url.toString());
      }}
      onClickRow={goDetail}
    />
  );
}
