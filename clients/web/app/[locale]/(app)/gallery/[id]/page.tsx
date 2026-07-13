'use client';

import { use } from 'react';
import { GalleryDetailView } from '@autix/shared-ui/gallery';

interface Props {
  params: Promise<{ id: string }>;
}

export default function GalleryDetailPage({ params }: Props) {
  const { id } = use(params);
  return <GalleryDetailView id={id} />;
}
