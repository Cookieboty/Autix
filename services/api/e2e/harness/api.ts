/**
 * 带 Bearer 的最小 HTTP 客户端。ResponseInterceptor 会把返回包成 { code, data, ... }，
 * 这里统一解包 data。
 */
import { E2E } from './config';

async function unwrap(res: Response) {
  const body: any = await res.json().catch(() => null);
  const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  return { status: res.status, data, raw: body };
}

export function apiClient(token: string) {
  const auth = { authorization: `Bearer ${token}` };
  return {
    async post(pathname: string, json?: unknown) {
      const res = await fetch(`${E2E.baseUrl}${pathname}`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: json === undefined ? undefined : JSON.stringify(json),
      });
      return unwrap(res);
    },
    async get(pathname: string) {
      const res = await fetch(`${E2E.baseUrl}${pathname}`, { headers: auth });
      return unwrap(res);
    },
  };
}
