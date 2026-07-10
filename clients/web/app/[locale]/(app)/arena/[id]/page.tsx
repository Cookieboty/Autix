'use client';

import { use } from 'react';
import { ArenaView } from '@autix/shared-ui/arena';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ArenaSessionPage({ params }: Props) {
  const { id } = use(params);
  return <ArenaView sessionId={id} />;
}
