import { ipcMain, shell } from 'electron';
import { createServer } from 'http';
import { buildAuthorizeRequestUrl, loopbackRedirectUri, parseCallbackResult } from '../oauth-loopback';

const TIMEOUT_MS = 5 * 60 * 1000;

type StartInput = { provider: string; apiBaseUrl: string; systemCode: string; inviteCode?: string };
type StartResult = { code?: string; error?: string };

function runLoopbackFlow(input: StartInput): Promise<StartResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: StartResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      resolve(r);
    };

    const server = createServer((req, res) => {
      const result = parseCallbackResult(req.url ?? '');
      const done = Boolean(result.code || result.error);
      res.writeHead(done ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(done ? '<html><body>登录完成，可关闭此窗口。</body></html>' : 'not found');
      if (done) finish(result);
    });

    const timer = setTimeout(() => finish({ error: 'timeout' }), TIMEOUT_MS);

    server.listen(0, '127.0.0.1', async () => {
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const redirectUri = loopbackRedirectUri(port);
        const authReq = buildAuthorizeRequestUrl(input.apiBaseUrl, input.provider, {
          systemCode: input.systemCode, redirectUri, inviteCode: input.inviteCode,
        });
        const resp = await fetch(authReq);
        if (!resp.ok) return finish({ error: 'start_failed' });
        const json = (await resp.json()) as { data?: { authorizeUrl?: string }; authorizeUrl?: string };
        const authorizeUrl = json.data?.authorizeUrl ?? json.authorizeUrl; // ResponseInterceptor 包了一层 data
        if (!authorizeUrl) return finish({ error: 'start_failed' });
        await shell.openExternal(authorizeUrl);
      } catch {
        finish({ error: 'start_failed' });
      }
    });
  });
}

export function registerOAuthIpc(): void {
  ipcMain.handle('auth:start-oauth', (_e, input: StartInput) => runLoopbackFlow(input));
}
