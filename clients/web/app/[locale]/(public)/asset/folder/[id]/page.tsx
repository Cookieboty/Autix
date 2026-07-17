'use client';

import { useParams } from 'next/navigation';
import { AssetLibraryView } from '@autix/shared-ui/growth';

/** 文件夹视图：在「全部」的基础上按 folderId 收窄。 */
export default function AssetFolderPage() {
  const params = useParams<{ id: string }>();

  return <AssetLibraryView bucket="all" folderId={params.id} />;
}
