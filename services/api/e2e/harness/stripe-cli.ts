/**
 * 封装 Stripe CLI：取本机 webhook 签名密钥、转发真实 test-mode 事件到本地服务，
 * 以及测试结束后清理本次在 Stripe 建的 customer/subscription。
 */
import { spawn, execFile, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** stripe listen --print-secret：拿到本机稳定的 whsec_（与 forwarding 用同一把）。 */
export async function getWebhookSecret(): Promise<string> {
  const { stdout } = await execFileAsync('stripe', ['listen', '--print-secret']);
  const secret = stdout.trim();
  if (!secret.startsWith('whsec_')) {
    throw new Error(`stripe listen --print-secret 未返回 whsec_（got: ${secret.slice(0, 12)}…）`);
  }
  return secret;
}

export type ForwardHandle = { stop: () => void; proc: ChildProcess };

/** 转发全部 test-mode webhook 到本地服务，等待 "Ready!" 后返回。 */
export function startForwarding(forwardTo: string): Promise<ForwardHandle> {
  return new Promise((resolve, reject) => {
    const proc = spawn('stripe', ['listen', '--forward-to', forwardTo], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => {
      try {
        proc.kill('SIGINT');
      } catch {
        /* noop */
      }
      const t = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          /* noop */
        }
      }, 3_000);
      t.unref?.();
    };
    let ready = false;
    const onData = (buf: Buffer) => {
      if (!ready && /Ready!/i.test(buf.toString())) {
        ready = true;
        resolve({ stop, proc });
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData); // stripe listen 把 "Ready!" 打到 stderr
    proc.on('error', reject);
    setTimeout(() => {
      if (!ready) reject(new Error('stripe listen 未在 90s 内 Ready'));
    }, 90_000);
  });
}

const STRIPE_API = 'https://api.stripe.com';

async function stripeApi(method: string, path: string): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return;
  await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}` },
  }).catch(() => undefined);
}

/** 清理本次在 Stripe 建的对象，避免 test-mode 堆积。 */
export async function cleanupStripe(refs: { subscriptionId?: string; customerId?: string }) {
  if (refs.subscriptionId) {
    await stripeApi('DELETE', `/v1/subscriptions/${encodeURIComponent(refs.subscriptionId)}`);
  }
  if (refs.customerId) {
    await stripeApi('DELETE', `/v1/customers/${encodeURIComponent(refs.customerId)}`);
  }
}
