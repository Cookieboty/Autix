import { TraceContext } from './trace-context';
import { TraceContextMiddleware } from './trace-context.middleware';
import type { Request, Response } from 'express';

function makeReqRes(headers: Record<string, string | string[]> = {}) {
  const setHeader = vi.fn();
  const req = {
    headers,
    method: 'GET',
    originalUrl: '/api/foo',
    url: '/api/foo',
  } as unknown as Request;
  const res = { setHeader } as unknown as Response;
  return { req, res, setHeader };
}

describe('TraceContextMiddleware', () => {
  it('reuses valid X-Request-Id from client and echoes it in response header', () => {
    const mw = new TraceContextMiddleware();
    const { req, res, setHeader } = makeReqRes({ 'x-request-id': 'abc-1234-req-id' });

    let observed: string | undefined;
    mw.use(req, res, () => {
      observed = TraceContext.getTraceId();
    });

    expect(observed).toBe('abc-1234-req-id');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-1234-req-id');
  });

  it('generates uuid when client header is missing', () => {
    const mw = new TraceContextMiddleware();
    const { req, res } = makeReqRes();

    let observed: string | undefined;
    mw.use(req, res, () => {
      observed = TraceContext.getTraceId();
    });

    expect(observed).toBeDefined();
    expect(observed).toMatch(/^[0-9a-f-]{16,}$/);
  });

  it('rejects malicious X-Request-Id and falls back to generated one', () => {
    const mw = new TraceContextMiddleware();
    const { req, res } = makeReqRes({ 'x-request-id': 'bad id with spaces!!' });

    let observed: string | undefined;
    mw.use(req, res, () => {
      observed = TraceContext.getTraceId();
    });

    expect(observed).not.toBe('bad id with spaces!!');
    expect(observed).toMatch(/^[0-9a-f-]{16,}$/);
  });

  it('isolates trace context between concurrent requests', async () => {
    const mw = new TraceContextMiddleware();

    const run = (id: string) =>
      new Promise<string | undefined>((resolve) => {
        const { req, res } = makeReqRes({ 'x-request-id': id });
        mw.use(req, res, () => {
          setTimeout(() => resolve(TraceContext.getTraceId()), 10);
        });
      });

    const [a, b] = await Promise.all([run('trace-aaa-1'), run('trace-bbb-2')]);
    expect(a).toBe('trace-aaa-1');
    expect(b).toBe('trace-bbb-2');
  });
});

describe('TraceContext outside request', () => {
  it('returns undefined when no store is active', () => {
    expect(TraceContext.getTraceId()).toBeUndefined();
  });
});
