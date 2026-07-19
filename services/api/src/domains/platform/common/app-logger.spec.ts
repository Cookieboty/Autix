import { AppLogger } from './app-logger';
import { TraceContext } from './trace-context';

describe('AppLogger', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Nest Logger 走 process.stdout.write，不走 console.log。
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderedOutput(): string {
    return writeSpy.mock.calls.map((c) => String(c[0] ?? '')).join('');
  }

  it('prefixes string messages with traceId from context', () => {
    const logger = new AppLogger('TestCtx');
    TraceContext.run(
      { traceId: 'trace-xyz-777', startedAt: Date.now() },
      () => {
        logger.log('hello world');
      },
    );

    const rendered = renderedOutput();
    expect(rendered).toContain('[trace=trace-xyz-777]');
    expect(rendered).toContain('hello world');
  });

  it('leaves message untouched when outside any trace context', () => {
    const logger = new AppLogger('TestCtx');
    logger.log('no trace here');

    const rendered = renderedOutput();
    expect(rendered).toContain('no trace here');
    expect(rendered).not.toContain('[trace=');
  });

  it('inherits traceId across await boundaries', async () => {
    const logger = new AppLogger('AsyncCtx');
    await new Promise<void>((resolve) => {
      TraceContext.run(
        { traceId: 'trace-async-42', startedAt: Date.now() },
        async () => {
          await Promise.resolve();
          await new Promise((r) => setTimeout(r, 5));
          logger.log('after await');
          resolve();
        },
      );
    });

    const rendered = renderedOutput();
    expect(rendered).toContain('[trace=trace-async-42]');
  });

  it('prefixes both trace and correlation id when correlation exists', () => {
    // 修复 P1：若只输出 traceId、correlationId 只放响应头，服务端日志无法把
    // 同一轮询会话（多次请求各自独立 traceId）在日志里聚合起来。
    const logger = new AppLogger('CorrCtx');
    TraceContext.run(
      {
        traceId: 'trace-req-a',
        correlationId: 'poll-video-42',
        startedAt: Date.now(),
      },
      () => {
        logger.log('polling tick');
      },
    );

    const rendered = renderedOutput();
    expect(rendered).toContain('[trace=trace-req-a]');
    expect(rendered).toContain('[corr=poll-video-42]');
  });

  it('omits [corr=] when no correlationId is set', () => {
    const logger = new AppLogger('NoCorrCtx');
    TraceContext.run(
      { traceId: 'trace-plain-1', startedAt: Date.now() },
      () => {
        logger.log('plain message');
      },
    );
    const rendered = renderedOutput();
    expect(rendered).toContain('[trace=trace-plain-1]');
    expect(rendered).not.toContain('[corr=');
  });
});
