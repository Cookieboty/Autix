'use client';

import { notFound, useParams } from 'next/navigation';
import { AssetLibraryView } from '@autix/shared-ui/growth';
import type { AssetBucket } from '@autix/shared-store';

const BUCKETS: AssetBucket[] = ['all', 'favorites', 'uploads', 'image', 'video', 'audio'];

function isBucket(value: string): value is AssetBucket {
  return (BUCKETS as string[]).includes(value);
}

/**
 * /asset/all | /asset/favorites | /asset/uploads | /asset/image | /asset/video | /asset/audio。
 * 文件夹视图走静态段 /asset/folder/[id]（静态段优先于本动态段，不会撞车）。
 */
export default function AssetBucketPage() {
  const params = useParams<{ bucket: string }>();
  const bucket = params.bucket;

  if (!isBucket(bucket)) notFound();

  return <AssetLibraryView bucket={bucket} />;
}
