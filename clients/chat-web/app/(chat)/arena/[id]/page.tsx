'use client';

import { use } from 'react';
import { ArenaView } from '@/components/arena/ArenaView';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ArenaSessionPage({ params }: Props) {
  const { id } = use(params);
  return <ArenaView sessionId={id} />;
}
