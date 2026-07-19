import { of, lastValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { I18nService } from '../i18n/i18n.service';
import { ResponseInterceptor } from './response.interceptor';
import { TraceContext } from './trace-context';

function makeContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ lang: 'zh-CN' }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler<T>(data: T): CallHandler {
  return { handle: () => of(data) };
}

const i18nStub = {
  t: (_lang: string, _key: string) => 'ok',
} as unknown as I18nService;

describe('ResponseInterceptor', () => {
  it('对未包含 success 字段的数据做标准包装并注入 traceId', async () => {
    const interceptor = new ResponseInterceptor(i18nStub);
    const observed = await TraceContext.run(
      { traceId: 'trace-standard-1', startedAt: Date.now() },
      () =>
        lastValueFrom(
          interceptor.intercept(makeContext(), makeHandler({ hello: 'world' })),
        ),
    );

    expect(observed).toMatchObject({
      success: true,
      code: '200',
      traceId: 'trace-standard-1',
      data: { hello: 'world' },
    });
  });

  it('对 { success: true } 短路分支补写 traceId（原 P2 bug 场景）', async () => {
    const interceptor = new ResponseInterceptor(i18nStub);
    // 部分接口自行返回 { success: true } 且不带 traceId，原先直接透出会丢 trace 关联。
    const payload = { success: true, extra: 1 };
    const observed = await TraceContext.run(
      { traceId: 'trace-shortcircuit-2', startedAt: Date.now() },
      () =>
        lastValueFrom(
          interceptor.intercept(makeContext(), makeHandler(payload)),
        ),
    );

    expect(observed).toMatchObject({
      success: true,
      extra: 1,
      traceId: 'trace-shortcircuit-2',
    });
  });

  it('不覆盖调用方已经写入的非空 traceId', async () => {
    const interceptor = new ResponseInterceptor(i18nStub);
    const payload = { success: true, traceId: 'caller-provided-3' };
    const observed = await TraceContext.run(
      { traceId: 'trace-should-not-override-4', startedAt: Date.now() },
      () =>
        lastValueFrom(
          interceptor.intercept(makeContext(), makeHandler(payload)),
        ),
    );

    expect((observed as { traceId?: string }).traceId).toBe('caller-provided-3');
  });

  it('上下文缺失时短路分支写入空串（应由 all-exceptions.filter/bootstrap 兜底）', async () => {
    const interceptor = new ResponseInterceptor(i18nStub);
    const observed = await lastValueFrom(
      interceptor.intercept(makeContext(), makeHandler({ success: true })),
    );
    expect((observed as { traceId?: string }).traceId).toBe('');
  });
});
