import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VideoShareTokenPayload {
  version: 1;
  projectId: string;
  userId: string;
  issuedAt: number;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function isValidPayload(value: unknown): value is VideoShareTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<VideoShareTokenPayload>;
  return (
    payload.version === 1 &&
    typeof payload.projectId === 'string' &&
    payload.projectId.length > 0 &&
    typeof payload.userId === 'string' &&
    payload.userId.length > 0 &&
    typeof payload.issuedAt === 'number' &&
    Number.isFinite(payload.issuedAt)
  );
}

export function createVideoShareToken(
  payload: Omit<VideoShareTokenPayload, 'version' | 'issuedAt'> & { issuedAt?: number },
  secret: string,
) {
  const encodedPayload = encodeBase64Url(JSON.stringify({
    version: 1,
    projectId: payload.projectId,
    userId: payload.userId,
    issuedAt: payload.issuedAt ?? Date.now(),
  } satisfies VideoShareTokenPayload));
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifyVideoShareToken(
  token: string,
  secret: string,
): VideoShareTokenPayload | null {
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra !== undefined) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encodedPayload));
    return isValidPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
