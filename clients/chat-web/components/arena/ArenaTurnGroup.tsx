'use client';

import { ArenaResponseCard } from './ArenaResponseCard';
import type { LocalArenaTurn } from '@/store/arena.store';

interface ArenaTurnGroupProps {
  turn: LocalArenaTurn;
}

export function ArenaTurnGroup({ turn }: ArenaTurnGroupProps) {
  const modelCount = turn.responses.length;
  const hasImages = turn.images && turn.images.length > 0;

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
          {hasImages && (
            <div className="flex flex-wrap gap-2 mt-2">
              {turn.images!.map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-20 h-20 rounded-md overflow-hidden flex-shrink-0"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <img
                    src={src}
                    alt={`user-image-${i}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
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
