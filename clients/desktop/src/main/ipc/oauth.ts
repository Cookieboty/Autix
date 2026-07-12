import { ipcMain, shell } from 'electron';
import { createServer } from 'http';
import { randomBytes } from 'crypto';
import { buildAuthorizeRequestUrl, loopbackRedirectUri, parseCallbackResult } from '../oauth-loopback';
import {
  reserveOAuthStepUpLoopback,
  type OAuthStepUpLoopbackReservation,
} from '../oauth-step-up-loopback';

const TIMEOUT_MS = 5 * 60 * 1000;

type StartInput = { provider: string; apiBaseUrl: string; systemCode: string; inviteCode?: string };
type StartResult = { code?: string; error?: string };

let pendingFlow: Promise<StartResult> | null = null;

const stepUpFlows = new Map<string, OAuthStepUpLoopbackReservation>();

async function reserveStepUp(): Promise<{ redirectUri: string; flowId: string }> {
  const flow = await reserveOAuthStepUpLoopback(TIMEOUT_MS);
  stepUpFlows.set(flow.flowId, flow);
  void flow.result.catch(() => stepUpFlows.delete(flow.flowId));
  return { redirectUri: flow.redirectUri, flowId: flow.flowId };
}

function cleanupStepUp(flowId: string): void {
  const flow = stepUpFlows.get(flowId);
  if (!flow) return;
  flow.cancel();
  stepUpFlows.delete(flowId);
}

function runLoopbackFlow(input: StartInput): Promise<StartResult> {
  return new Promise((resolve) => {
    let settled = false;
    // 安全（#5）：每次登录流程生成不可猜测的 state token，回调必须携带且严格相等，防本机进程抢注 code。
    const stateToken = randomBytes(24).toString('hex');
    const finish = (r: StartResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      resolve(r);
    };

    const server = createServer((req, res) => {
      const result = parseCallbackResult(req.url ?? '', stateToken);
      const done = Boolean(result.code || result.error);
      res.writeHead(done ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(done ? '<html><body>登录完成，可关闭此窗口。</body></html>' : 'not found');
      if (done) finish(result);
    });

    const timer = setTimeout(() => finish({ error: 'timeout' }), TIMEOUT_MS);

    server.on('error', () => finish({ error: 'start_failed' }));
    server.listen(0, '127.0.0.1', async () => {
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const redirectUri = loopbackRedirectUri(port, stateToken);
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
  ipcMain.handle('auth:start-oauth', (_e, input: StartInput) => {
    if (pendingFlow) return pendingFlow;
    pendingFlow = runLoopbackFlow(input).finally(() => { pendingFlow = null; });
    return pendingFlow;
  });
  ipcMain.handle('oauth:step-up:reserve-loopback', () => reserveStepUp());
  ipcMain.handle('oauth:step-up:open', async (_event, input: { flowId: string; authorizeUrl: string }) => {
    if (!stepUpFlows.has(input.flowId)) throw new Error('OAUTH_STEP_UP_FLOW_INVALID');
    // 安全：只允许用可信主进程打开 https 授权 URL。若 renderer 被攻陷（XSS），不加校验会让攻击者
    // 借主进程 shell.openExternal 打开 file:/自定义协议处理器等危险 scheme。
    let parsed: URL;
    try { parsed = new URL(input.authorizeUrl); } catch { throw new Error('OAUTH_STEP_UP_URL_INVALID'); }
    if (parsed.protocol !== 'https:') throw new Error('OAUTH_STEP_UP_URL_INVALID');
    await shell.openExternal(input.authorizeUrl);
  });
  ipcMain.handle('oauth:step-up:await-callback', async (_event, input: { flowId: string }) => {
    const flow = stepUpFlows.get(input.flowId);
    if (!flow) throw new Error('OAUTH_STEP_UP_FLOW_INVALID');
    try {
      return await flow.result;
    } finally {
      cleanupStepUp(input.flowId);
    }
  });
  ipcMain.handle('oauth:step-up:cancel', (_event, input: { flowId: string }) => {
    cleanupStepUp(input.flowId);
  });
}
