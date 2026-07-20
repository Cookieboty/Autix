import { describe, expect, it } from 'vitest';
import { buildListParams, formatDuration, statusTone } from './generation-task-view.helpers';

describe('buildListParams', () => {
  it('空筛选项不进入参数 —— 否则会给后端送一堆空串', () => {
    expect(buildListParams({ kind: '', status: '', q: '' }, null)).toEqual({ limit: 20 });
  });

  it('有值的筛选项与游标一起带上', () => {
    expect(buildListParams({ kind: 'IMAGE', status: 'FAILED', q: 't-1' }, 'cur-9')).toEqual({
      limit: 20,
      kind: 'IMAGE',
      status: 'FAILED',
      q: 't-1',
      cursor: 'cur-9',
    });
  });
});

describe('formatDuration', () => {
  it('null 显示占位而不是 NaN', () => {
    expect(formatDuration(null)).toBe('—');
  });
  it('毫秒/秒/分各有可读形式', () => {
    expect(formatDuration(830)).toBe('830ms');
    expect(formatDuration(5_400)).toBe('5.4s');
    expect(formatDuration(185_000)).toBe('3m5s');
  });
});

describe('statusTone', () => {
  it('失败态与成功态必须区分 —— 表格靠它上色', () => {
    expect(statusTone('SUCCEEDED')).toBe('success');
    expect(statusTone('FAILED')).toBe('danger');
    expect(statusTone('EXPIRED')).toBe('danger');
    expect(statusTone('PENDING')).toBe('neutral');
    expect(statusTone('QUEUED')).toBe('neutral');
  });
});
