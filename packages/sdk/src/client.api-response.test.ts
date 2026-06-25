import { describe, it, expect } from 'vitest';
import type { ApiResponse } from '@autix/domain';

describe('sdk ApiResponse uses domain contract', () => {
  it('carries typed wrapped payloads', () => {
    type ListPayload = { list: number[]; pagination: { total: number } };
    const resp: ApiResponse<ListPayload> = {
      success: true, code: '0', msg: 'ok', traceId: 't-1',
      data: { list: [1, 2], pagination: { total: 2 } },
    };
    expect(resp.data.list).toHaveLength(2);
    expect(resp.data.pagination.total).toBe(2);
  });
});
