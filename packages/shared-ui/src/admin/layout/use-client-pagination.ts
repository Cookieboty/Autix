import { useEffect, useMemo, useState } from 'react';

export type ClientPaginationResult<T> = {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
};

// resetKey: 传入筛选/作用域标识，其变化时自动回到第 1 页，行为与服务端分页视图一致。
export function useClientPagination<T>(
  source: readonly T[] | undefined,
  pageSize = 20,
  resetKey?: unknown,
): ClientPaginationResult<T> {
  const [page, setPage] = useState(1);
  const total = source?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // 列表缩短到当前页之前时向下夹取，避免停在空页。
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);

  const items = useMemo(() => {
    if (!source) return [];
    const start = (safePage - 1) * pageSize;
    return source.slice(start, start + pageSize);
  }, [source, safePage, pageSize]);

  return { page: safePage, setPage, pageSize, total, totalPages, items };
}
