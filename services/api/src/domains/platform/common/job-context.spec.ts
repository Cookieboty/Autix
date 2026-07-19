import { runInJobContext } from './job-context';
import { TraceContext } from './trace-context';
import { AppLogger } from './app-logger';

// 该 wrapper 已被 13 个调度入口依赖，直接补纯单测覆盖它的每一条 outcome 分支：
//   - undefined：完全静默（保留 "0 时不打 info" 契约）
//   - { noop }: 走 debug（不污染 info 通道）
//   - { changed }: 走 info；slowMs 达阈值升级到 warn
//   - { failed }: 走 error 并解析 reason/error/unknown
//   - 抛异常：走 error 并原样 rethrow
// 同时验证 traceId 在 fn() 内的 async 边界后仍然可读——这是所有下游日志前缀
// 依赖的隐性契约。
describe('runInJobContext', () => {
  function makeLogger() {
    return {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as AppLogger & {
      log: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
    };
  }

  it('start 一律 debug、undefined outcome 时完全不打 info（噪声约束）', async () => {
    const logger = makeLogger();
    await runInJobContext({ name: 'test.silent', logger }, async () => undefined);

    // start = debug
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(String(logger.debug.mock.calls[0]?.[0])).toContain('job start: test.silent');
    // 关键：undefined 时 wrapper 不打 info / error / warn
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('{ noop: true } 走 debug，不进 info 通道', async () => {
    const logger = makeLogger();
    await runInJobContext(
      { name: 'test.noop', logger },
      async () => ({ noop: true as const }),
    );

    // 2 条 debug：start + noop done
    expect(logger.debug).toHaveBeenCalledTimes(2);
    const secondDebug = String(logger.debug.mock.calls[1]?.[0]);
    expect(secondDebug).toContain('job noop: test.noop');
    expect(secondDebug).toMatch(/elapsedMs=\d+/);
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('{ changed } 走 info 并携带数量与耗时', async () => {
    const logger = makeLogger();
    await runInJobContext(
      { name: 'test.changed', logger },
      async () => ({ changed: 5 as const }),
    );

    expect(logger.log).toHaveBeenCalledTimes(1);
    const line = String(logger.log.mock.calls[0]?.[0]);
    expect(line).toContain('job done: test.changed');
    expect(line).toContain('changed=5');
    expect(line).toMatch(/elapsedMs=\d+/);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('{ changed, slowMs } 达阈值时升级为 warn，不走 info', async () => {
    const logger = makeLogger();
    // slowMs=0 会绕过 (slowMs > 0) 保护，走的是 slowMs=1 且实际耗时 >= 1ms 的路径。
    await runInJobContext({ name: 'test.slow', logger }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { changed: 2, slowMs: 1 } as const;
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const line = String(logger.warn.mock.calls[0]?.[0]);
    expect(line).toContain('job slow: test.slow');
    expect(line).toContain('changed=2');
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('业务返回 { failed, error: Error } 时走 error，解析出 err.message 并附上 stack', async () => {
    const logger = makeLogger();
    const error = new Error('db exploded');
    await runInJobContext(
      { name: 'test.failed', logger },
      async () => ({ failed: true as const, error }),
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [msg, stack] = logger.error.mock.calls[0] ?? [];
    expect(String(msg)).toContain('job failed: test.failed');
    expect(String(msg)).toContain('err=db exploded');
    expect(String(msg)).toMatch(/elapsedMs=\d+/);
    // Error 实例：stack 参数应透传（Nest Logger 契约）。
    expect(stack).toBe(error.stack);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('业务返回 { failed, reason } 时优先使用 reason 作为 err= 显示值', async () => {
    const logger = makeLogger();
    await runInJobContext(
      { name: 'test.reason', logger },
      async () => ({
        failed: true as const,
        reason: 'circuit-breaker-open',
        // 提供一个 error 但 reason 应胜出，验证优先级。
        error: new Error('ignored-because-reason-wins'),
      }),
    );

    const msg = String(logger.error.mock.calls[0]?.[0]);
    expect(msg).toContain('err=circuit-breaker-open');
    expect(msg).not.toContain('ignored-because-reason-wins');
  });

  it('业务返回 { failed } 但既无 reason 也无 error 时 err=unknown', async () => {
    const logger = makeLogger();
    await runInJobContext(
      { name: 'test.unknown', logger },
      async () => ({ failed: true as const }),
    );

    const msg = String(logger.error.mock.calls[0]?.[0]);
    expect(msg).toContain('err=unknown');
  });

  it('业务返回 { failed, error: 非 Error 值 } 时 String() 序列化', async () => {
    const logger = makeLogger();
    await runInJobContext(
      { name: 'test.stringify', logger },
      async () => ({ failed: true as const, error: 'raw-string-err' }),
    );

    const msg = String(logger.error.mock.calls[0]?.[0]);
    expect(msg).toContain('err=raw-string-err');
    // 非 Error 值不应携带 stack。
    expect(logger.error.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('fn() 抛异常时打一条 error 并原样 rethrow', async () => {
    const logger = makeLogger();
    const err = new Error('boom');
    await expect(
      runInJobContext({ name: 'test.throws', logger }, async () => {
        throw err;
      }),
    ).rejects.toBe(err);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [msg, stack] = logger.error.mock.calls[0] ?? [];
    expect(String(msg)).toContain('job failed: test.throws');
    expect(String(msg)).toContain('err=boom');
    expect(stack).toBe(err.stack);
  });

  it('fn() 内可以通过 TraceContext.getTraceId() 读到 job traceId，且跨 await 保留', async () => {
    const logger = makeLogger();
    let observedBefore: string | undefined;
    let observedAfter: string | undefined;

    await runInJobContext({ name: 'test.trace', logger }, async () => {
      observedBefore = TraceContext.getTraceId();
      await new Promise((r) => setTimeout(r, 3));
      observedAfter = TraceContext.getTraceId();
      return undefined;
    });

    expect(observedBefore).toBeDefined();
    expect(observedBefore).toMatch(/^job-test\.trace-/);
    // async 边界后仍在同一 store 内。
    expect(observedAfter).toBe(observedBefore);
    // wrapper 退出后上下文自然结束。
    expect(TraceContext.getTraceId()).toBeUndefined();
  });

  it('未传 logger 时 wrapper 保持静默但仍建立 trace 上下文', async () => {
    let observed: string | undefined;
    const result = await runInJobContext({ name: 'test.no-logger' }, async () => {
      observed = TraceContext.getTraceId();
      return { changed: 1 } as const;
    });

    expect(result).toEqual({ changed: 1 });
    expect(observed).toMatch(/^job-test\.no-logger-/);
  });
});
