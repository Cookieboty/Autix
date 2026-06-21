'use client';

import { use } from 'react';
import { VideoSharePageView } from '@autix/shared-ui/video';

interface Props {
  params: Promise<{ code: string }>;
}

export default function ShortVideoSharePage({ params }: Props) {
  const { code } = use(params);
  return <VideoSharePageView code={code} />;
}
