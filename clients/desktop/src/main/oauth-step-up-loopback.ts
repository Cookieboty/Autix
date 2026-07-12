import { randomBytes, randomUUID } from 'crypto';
import { createServer } from 'http';

export type OAuthStepUpLoopbackResult =
  | { proof: string; purpose: string }
  | { linked: string };

export interface OAuthStepUpLoopbackReservation {
  flowId: string;
  redirectUri: string;
  result: Promise<OAuthStepUpLoopbackResult>;
  cancel(): void;
}

export async function reserveOAuthStepUpLoopback(
  timeoutMs = 5 * 60 * 1000,
): Promise<OAuthStepUpLoopbackReservation> {
  const flowId = randomUUID();
  const path = `/step-up/${randomBytes(16).toString('hex')}`;
  const state = randomBytes(24).toString('hex');
  let settled = false;
  const timerRef: { current?: ReturnType<typeof setTimeout> } = {};
  let resolveResult!: (value: OAuthStepUpLoopbackResult) => void;
  let rejectResult!: (reason: Error) => void;
  const result = new Promise<OAuthStepUpLoopbackResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  void result.catch(() => {});

  const closeServer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    server.close();
  };
  const resolveOnce = (value: OAuthStepUpLoopbackResult) => {
    if (settled) return;
    settled = true;
    resolveResult(value);
    closeServer();
  };
  const rejectOnce = (error: Error) => {
    if (settled) return;
    settled = true;
    rejectResult(error);
    closeServer();
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const headers = {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    };
    if (url.pathname !== path || url.searchParams.get('state') !== state) {
      res.writeHead(404, headers).end('not found');
      return;
    }

    const error = url.searchParams.get('error');
    const proof = url.searchParams.get('proof');
    const purpose = url.searchParams.get('purpose');
    const linked = url.searchParams.get('linked');
    if (error) {
      res.writeHead(400, headers).end('invalid callback');
      rejectOnce(new Error(error));
      return;
    }
    if (linked) {
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'",
      });
      res.end('<!doctype html><script>history.replaceState(null,"","/");window.close()</script>Authentication complete.');
      resolveOnce({ linked });
      return;
    }
    if (!proof || !purpose) {
      res.writeHead(400, headers).end('invalid callback');
      rejectOnce(new Error('STEP_UP_INVALID_OR_EXPIRED'));
      return;
    }

    res.writeHead(200, {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'",
    });
    res.end('<!doctype html><script>history.replaceState(null,"","/");window.close()</script>Authentication complete.');
    resolveOnce({ proof, purpose });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const redirectUri = `http://127.0.0.1:${port}${path}?state=${state}`;
  timerRef.current = setTimeout(
    () => rejectOnce(new Error('OAUTH_STEP_UP_TIMEOUT')),
    timeoutMs,
  );

  return {
    flowId,
    redirectUri,
    result,
    cancel: () => rejectOnce(new Error('OAUTH_STEP_UP_CANCELLED')),
  };
}
