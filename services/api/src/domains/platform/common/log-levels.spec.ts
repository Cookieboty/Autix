import { describe, expect, it } from 'vitest';
import {
  ALL_LOG_LEVELS,
  DEFAULT_LOG_LEVELS,
  resolveLogLevels,
  resolveLogLevelsFromEnv,
} from './log-levels';

describe('resolveLogLevels', () => {
  it('production 默认屏蔽 debug/verbose（评审 P1 关键性能保证）', () => {
    // 兜住"生产默认不吐 debug"这一硬性契约；如果有人不小心把默认值改宽，
    // 288 万条/天 的 poll debug 日志会立刻回归，这条断言必须失败。
    const levels = resolveLogLevels({ nodeEnv: 'production' });
    expect(levels).toEqual([...DEFAULT_LOG_LEVELS]);
    expect(levels).not.toContain('debug');
    expect(levels).not.toContain('verbose');
  });

  it('非 production 默认打开全部级别，便于本地/CI 排障', () => {
    expect(resolveLogLevels({ nodeEnv: 'development' })).toEqual([
      ...ALL_LOG_LEVELS,
    ]);
    expect(resolveLogLevels({ nodeEnv: undefined })).toEqual([
      ...ALL_LOG_LEVELS,
    ]);
    expect(resolveLogLevels({ nodeEnv: 'test' })).toEqual([...ALL_LOG_LEVELS]);
  });

  it('LOG_LEVEL=all（不区分大小写、含空格）启用全部级别，可覆盖 production 默认', () => {
    expect(
      resolveLogLevels({ logLevel: 'all', nodeEnv: 'production' }),
    ).toEqual([...ALL_LOG_LEVELS]);
    expect(
      resolveLogLevels({ logLevel: '  ALL  ', nodeEnv: 'production' }),
    ).toEqual([...ALL_LOG_LEVELS]);
  });

  it('LOG_LEVEL 逗号分隔的合法值按传入顺序保留、大小写与空格容错', () => {
    const levels = resolveLogLevels({
      logLevel: 'log, ERROR ,Debug',
      nodeEnv: 'production',
    });
    expect(levels).toEqual(['log', 'error', 'debug']);
  });

  it('LOG_LEVEL 中的非法值被过滤，仍以合法子集为准', () => {
    const levels = resolveLogLevels({
      logLevel: 'log,info,warn,silly',
      nodeEnv: 'production',
    });
    // Nest LogLevel 不包含 info/silly，必须被过滤掉。
    expect(levels).toEqual(['log', 'warn']);
  });

  it('LOG_LEVEL 全部非法或为空时，退回默认策略而不是静默禁用日志', () => {
    // 关键护栏：过滤后若为空绝不返回 []（那会关闭全部日志），必须回落默认。
    expect(
      resolveLogLevels({ logLevel: 'trace,silly', nodeEnv: 'production' }),
    ).toEqual([...DEFAULT_LOG_LEVELS]);
    expect(
      resolveLogLevels({ logLevel: '  ', nodeEnv: 'production' }),
    ).toEqual([...DEFAULT_LOG_LEVELS]);
    expect(resolveLogLevels({ logLevel: '', nodeEnv: 'development' })).toEqual([
      ...ALL_LOG_LEVELS,
    ]);
  });

  it('每次调用返回独立数组，调用方原地修改不会污染下一次结果', () => {
    const a = resolveLogLevels({ nodeEnv: 'production' });
    a.push('debug');
    const b = resolveLogLevels({ nodeEnv: 'production' });
    expect(b).toEqual([...DEFAULT_LOG_LEVELS]);
  });
});

describe('resolveLogLevelsFromEnv', () => {
  it('从传入的 env 读取 LOG_LEVEL 与 NODE_ENV', () => {
    expect(
      resolveLogLevelsFromEnv({
        LOG_LEVEL: 'log,warn',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toEqual(['log', 'warn']);
  });

  it('env 缺失时也按 nodeEnv 默认策略处理', () => {
    expect(resolveLogLevelsFromEnv({} as NodeJS.ProcessEnv)).toEqual([
      ...ALL_LOG_LEVELS,
    ]);
    expect(
      resolveLogLevelsFromEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toEqual([...DEFAULT_LOG_LEVELS]);
  });
});
