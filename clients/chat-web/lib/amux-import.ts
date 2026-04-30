import { chatApi, createModel, getAvailableModels, type ModelConfigItem } from './api';

const POLL_INTERVAL_MS = 5000;
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_CLIENT_ID = process.env.NEXT_PUBLIC_AMUX_CLIENT_ID || 'amux-desktop';
const AMUX_HOST = (process.env.NEXT_PUBLIC_AMUX_HOST || 'https://api.amux.ai').replace(/\/$/, '');
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
    case 'text':      return ['text'];
    case 'multimodal': return ['text', 'vision'];
    case 'image':     return ['image'];
    case 'audio':     return ['voice', 'speech'];
    case 'embedding': return ['embedding'];
    case 'video':     return ['text'];
    default:          return ['text'];
  }
}

export function getAmuxHost() {
  return AMUX_HOST;
}

// ── Credential API (DB persistence) ─────────────────────────────

export interface SavedCredential {
  host: string;
  oat: string;
  amuxUserId: number;
}

export async function getSavedCredential(): Promise<SavedCredential | null> {
  try {
    const res = await chatApi.get('/api/amux/credential');
    const data = (res as any).data ?? res;
    return data?.oat ? data : null;
  } catch {
    return null;
  }
}

export async function saveCredential(host: string, oat: string, amuxUserId: number) {
  await chatApi.post('/api/amux/credential', { host, oat, amuxUserId });
}

// ── OAuth Device Flow ────────────────────────────────────────────

export async function startOAuthDeviceFlow(clientId = DEFAULT_CLIENT_ID) {
  const sessionId = crypto.randomUUID();
  await chatApi.post(
    '/api/amux/proxy/oauth/device/authorize',
    { session_id: sessionId, client_id: clientId },
    { headers: { 'X-Amux-Host': AMUX_HOST } },
  );
  const authorizeUrl = `${AMUX_HOST}/oauth/authorize?session_id=${sessionId}`;
  return { sessionId, authorizeUrl };
}

export interface OAuthResult {
  status: 'authorized' | 'expired';
  accessToken?: string;
  userId?: number;
}

export async function pollOAuthResult(sessionId: string, onPending?: () => void): Promise<OAuthResult> {
  const deadline = Date.now() + SESSION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await chatApi.get('/api/amux/proxy/oauth/device/check', {
      params: { session_id: sessionId },
      headers: { 'X-Amux-Host': AMUX_HOST },
    });
    const data = (res as any).data ?? res;
    if (data.status === 'authorized') {
      return { status: 'authorized', accessToken: data.access_token, userId: data.user_id };
    }
    if (data.status === 'expired') {
      return { status: 'expired' };
    }
    onPending?.();
  }
  return { status: 'expired' };
}

// ── Token (sk-) management ───────────────────────────────────────

export async function ensurePremiumToken(auth: AmuxAuth): Promise<string> {
  const headers = proxyHeaders(auth.host, auth);

  const searchRes = await chatApi.get('/api/amux/proxy/token/search', {
    params: { keyword: FIXED_TOKEN_NAME },
    headers,
  });
  const searchData = (searchRes as any).data ?? searchRes;
  const items = searchData?.data?.data ?? searchData?.data ?? searchData?.items ?? [];
  const existing = Array.isArray(items) ? items.find((t: any) => t.name === FIXED_TOKEN_NAME) : null;

  if (existing?.id) {
    const keyRes = await chatApi.post(`/api/amux/proxy/token/${existing.id}/key`, {}, { headers });
    const keyData = (keyRes as any).data ?? keyRes;
    const key = keyData?.data?.key ?? keyData?.key;
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
  const newData = (newSearchRes as any).data ?? newSearchRes;
  const newItems = newData?.data?.data ?? newData?.data ?? newData?.items ?? [];
  const found = Array.isArray(newItems) ? newItems.find((t: any) => t.name === FIXED_TOKEN_NAME) : null;

  if (!found?.id) throw new Error('Failed to find the created token');

  const keyRes = await chatApi.post(`/api/amux/proxy/token/${found.id}/key`, {}, { headers });
  const keyData = (keyRes as any).data ?? keyRes;
  const key = keyData?.data?.key ?? keyData?.key;
  if (!key) throw new Error('Failed to retrieve token key');
  return key;
}

// ── Fetch premium models ─────────────────────────────────────────

export async function fetchPremiumModels(auth: AmuxAuth): Promise<AmuxModel[]> {
  const res = await chatApi.get('/api/amux/proxy/user/models', {
    params: { group: 'premium', detail: 'true' },
    headers: proxyHeaders(auth.host, auth),
  });
  const data = (res as any).data ?? res;
  return data?.data ?? data ?? [];
}

// ── Import selected models ───────────────────────────────────────

export interface ImportResult {
  imported: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}

export async function importModelsToLocal(
  models: AmuxModel[],
  skToken: string,
  onProgress?: (current: number, total: number) => void,
): Promise<ImportResult> {
  const existing = await getAvailableModels();
  const existingData = (existing as any).data ?? existing;
  const existingModels = (Array.isArray(existingData) ? existingData : []) as ModelConfigItem[];
  const existingSet = new Set(existingModels.filter((m) => m.provider === 'amux').map((m) => m.model));

  const baseUrl = `${AMUX_HOST}/v1`;
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
        type: 'general',
        visibility: 'private',
        baseUrl,
        apiKey: skToken,
        capabilities: modalityToCapabilities(m.modality),
        isDefault: false,
        metadata: { baseUrl, apiKey: skToken },
      });
      result.imported.push(m.name);
    } catch (err: any) {
      result.failed.push({ name: m.name, error: err?.message ?? 'Unknown error' });
    }
  }

  return result;
}
