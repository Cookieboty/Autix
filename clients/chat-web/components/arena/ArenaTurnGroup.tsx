'use client';

import { ArenaResponseCard } from './ArenaResponseCard';
import type { LocalArenaTurn } from '@/store/arena.store';

interface ArenaTurnGroupProps {
  turn: LocalArenaTurn;
}

export function ArenaTurnGroup({ turn }: ArenaTurnGroupProps) {
  const modelCount = turn.responses.length;

  const gridCols =
    modelCount <= 2
      ? 'grid-cols-2'
      : modelCount === 3
        ? 'grid-cols-3'
        : 'grid-cols-4';

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div
          className="inline-block max-w-[85%] rounded-lg px-4 py-3 whitespace-pre-wrap text-[15px] leading-7 break-words"
          style={{
            backgroundColor: 'var(--chat-user-bubble)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
        >
          {turn.userMessage}
        </div>
      </div>

      <div className={`grid ${gridCols} gap-3`} style={{ minHeight: '120px' }}>
        {turn.responses.map((response) => (
          <ArenaResponseCard key={response.id} response={response} />
        ))}
      </div>
    </div>
  );
}
