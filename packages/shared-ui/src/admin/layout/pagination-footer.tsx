'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../ui';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  totalLabel?: string;
};

export function AdminPaginationFooter({ page, pageSize, total, onPageChange, totalLabel }: Props) {
  const tCommon = useTranslations('common');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (total <= 0) return null;

  const displayTotal = totalLabel ?? tCommon('totalCount', { total });

  return (
    <div className="flex items-center justify-between gap-2 border-t p-3" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{displayTotal}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="cursor-pointer"
            aria-label={tCommon('prevPage')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {tCommon('pageIndicator', { page, totalPages })}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="cursor-pointer"
            aria-label={tCommon('nextPage')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
