import { chatApi, createModel, getAvailableModels, type ModelConfigItem } from './api';
import { getEnv } from './adapters';

const POLL_INTERVAL_MS = 5000;
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const FIXED_TOKEN_NAME = 'autix-chat-import';

interface AmuxAuth {
  host: string;
  oat: string;
  userId: number;
}

export interface AmuxModel {
  name: string;
  modality: string;
  param_schema?: string;
}

function proxyHeaders(host: string, auth?: { oat: string; userId: number }) {
  const h: Record<string, string> = { 'X-Amux-Host': host };
  if (auth) {
    h['X-Amux-Token'] = auth.oat;
    h['X-Amux-User-Id'] = String(auth.userId);
  }
  return h;
}

function modalityToCapabilities(modality: string): string[] {
  switch (modality) {
    case 'text':
      return ['text'];
    case 'multimodal':
      return ['text', 'vision'];
    case 'image':
      return ['image'];
    case 'audio':
      return ['voice', 'speech'];
    case 'embedding':
      return ['embedding'];
    case 'video':
      return ['video'];
    default:
      return ['text'];
  }
}

function modalityToModelType(modality: string): string {
  if (modality === 'video') return 'video';
  if (modality === 'embedding') return 'embedding';
  return 'general';
}

export function getAmuxHost(host?: string): string {
  return (host || getEnv().amuxHost).replace(/\/$/, '');
}

export interface SavedCredential {
  host: string;
  oat: string;
  amuxUserId: number;
}

export async function getSavedCredential(): Promise<SavedCredential | null> {
  try {
    const res = await chatApi.get('/api/amux/credential');
    const data = (res as { data?: SavedCredential }).data ?? (res as unknown as SavedCredential);
    return data?.oat ? data : null;
  } catch {
    return null;
  }
}

export async function saveCredential(host: string, oat: string, amuxUserId: number) {
  await chatApi.post('/api/amux/credential', { host, oat, amuxUserId });
}

export async function startOAuthDeviceFlow(clientId?: string, host?: string) {
  const env = getEnv();
  const sessionId = crypto.randomUUID();
  const amuxHost = getAmuxHost(host);
  await chatApi.post(
    '/api/amux/proxy/oauth/device/authorize',
    { session_id: sessionId, client_id: clientId ?? env.amuxClientId },
    { headers: { 'X-Amux-Host': amuxHost } },
  );
  const authorizeUrl = `${amuxHost}/oauth/authorize?session_id=${sessionId}`;
  return { sessionId, authorizeUrl };
}

export interface OAuthResult {
  status: 'authorized' | 'expired';
  accessToken?: string;
  userId?: number;
}

export async function pollOAuthResult(
  sessionId: string,
  onPending?: () => void,
  host?: string,
): Promise<OAuthResult> {
  const deadline = Date.now() + SESSION_TIMEOUT_MS;
  const amuxHost = getAmuxHost(host);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await chatApi.get('/api/amux/proxy/oauth/device/check', {
      params: { session_id: sessionId },
      headers: { 'X-Amux-Host': amuxHost },
    });
    const data = (res as { data?: { status: string; access_token?: string; user_id?: number } })
      .data ?? (res as unknown as { status: string; access_token?: string; user_id?: number });
    if (data.status === 'authorized') {
      return {
        status: 'authorized',
        accessToken: data.access_token,
        userId: data.user_id,
      };
    }
    if (data.status === 'expired') {
      return { status: 'expired' };
    }
    onPending?.();
  }
  return { status: 'expired' };
}

export async function ensurePremiumToken(auth: AmuxAuth): Promise<string> {
  const headers = proxyHeaders(auth.host, auth);

  const searchRes = await chatApi.get('/api/amux/proxy/token/search', {
    params: { keyword: FIXED_TOKEN_NAME },
    headers,
  });
  const searchData = (searchRes as { data?: unknown }).data ?? searchRes;
  const items =
    ((searchData as { data?: { data?: unknown[] } })?.data?.data as unknown[] | undefined) ??
    ((searchData as { data?: unknown[] })?.data as unknown[] | undefined) ??
    ((searchData as { items?: unknown[] })?.items as unknown[] | undefined) ??
    [];
  const existing = Array.isArray(items)
    ? (items.find((t) => (t as { name?: string }).name === FIXED_TOKEN_NAME) as
        | { id?: string }
        | undefined)
    : undefined;

  if (existing?.id) {
    const keyRes = await chatApi.post(
      `/api/amux/proxy/token/${existing.id}/key`,
      {},
      { headers },
    );
    const keyData = (keyRes as { data?: unknown }).data ?? keyRes;
    const key =
      (keyData as { data?: { key?: string } })?.data?.key ??
      (keyData as { key?: string })?.key;
    if (key) return key;
  }

  await chatApi.post(
    '/api/amux/proxy/token/',
    { name: FIXED_TOKEN_NAME, group: 'premium', unlimited_quota: true, expired_time: -1 },
    { headers },
  );

  const newSearchRes = await chatApi.get('/api/amux/proxy/token/search', {
    params: { keyword: FIXED_TOKEN_NAME },
    headers,
  });
  const newData = (newSearchRes as { data?: unknown }).data ?? newSearchRes;
  const newItems =
    ((newData as { data?: { data?: unknown[] } })?.data?.data as unknown[] | undefined) ??
    ((newData as { data?: unknown[] })?.data as unknown[] | undefined) ??
    ((newData as { items?: unknown[] })?.items as unknown[] | undefined) ??
    [];
  const found = Array.isArray(newItems)
    ? (newItems.find((t) => (t as { name?: string }).name === FIXED_TOKEN_NAME) as
        | { id?: string }
        | undefined)
    : undefined;

  if (!found?.id) throw new Error('Failed to find the created token');

  const keyRes = await chatApi.post(
    `/api/amux/proxy/token/${found.id}/key`,
    {},
    { headers },
  );
  const keyData = (keyRes as { data?: unknown }).data ?? keyRes;
  const key =
    (keyData as { data?: { key?: string } })?.data?.key ??
    (keyData as { key?: string })?.key;
  if (!key) throw new Error('Failed to retrieve token key');
  return key;
}

export async function fetchPremiumModels(auth: AmuxAuth): Promise<AmuxModel[]> {
  const res = await chatApi.get('/api/amux/proxy/user/models', {
    params: { group: 'premium', detail: 'true' },
    headers: proxyHeaders(auth.host, auth),
  });
  const data = (res as { data?: unknown }).data ?? res;
  return ((data as { data?: AmuxModel[] })?.data ?? (data as AmuxModel[]) ?? []) as AmuxModel[];
}

export interface ImportResult {
  imported: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}

export async function importModelsToLocal(
  models: AmuxModel[],
  skToken: string,
  onProgress?: (current: number, total: number) => void,
  host?: string,
): Promise<ImportResult> {
  const existing = await getAvailableModels();
  const existingData = (existing as { data?: ModelConfigItem[] }).data ?? existing;
  const existingModels = (
    Array.isArray(existingData) ? existingData : []
  ) as ModelConfigItem[];
  const existingSet = new Set(
    existingModels.filter((m) => m.provider === 'amux').map((m) => m.model),
  );

  const baseUrl = `${getAmuxHost(host)}/v1`;
  const result: ImportResult = { imported: [], skipped: [], failed: [] };

  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    onProgress?.(i + 1, models.length);

    if (existingSet.has(m.name)) {
      result.skipped.push(m.name);
      continue;
    }

    try {
      await createModel({
        name: m.name,
        model: m.name,
        provider: 'amux',
        type: modalityToModelType(m.modality),
        visibility: 'private',
        baseUrl,
        apiKey: skToken,
        capabilities: modalityToCapabilities(m.modality),
        isDefault: false,
        metadata: { baseUrl, apiKey: skToken },
      });
      result.imported.push(m.name);
    } catch (err) {
      result.failed.push({
        name: m.name,
        error: (err as Error)?.message ?? 'Unknown error',
      });
    }
  }

  return result;
}
