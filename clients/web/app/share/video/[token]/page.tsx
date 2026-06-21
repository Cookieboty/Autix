'use client';

import { use } from 'react';
import { VideoSharePageView } from '@autix/shared-ui/video';

interface Props {
  params: Promise<{ token: string }>;
}

export default function VideoSharePage({ params }: Props) {
  const { token } = use(params);
  return <VideoSharePageView token={token} />;
}
