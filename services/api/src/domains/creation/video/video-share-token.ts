import { randomBytes } from 'node:crypto';

const SHARE_CODE_LENGTH = 8;

export function createVideoShareCode() {
  return randomBytes(8)
    .toString('base64url')
    .replace(/[-_]/g, '')
    .slice(0, SHARE_CODE_LENGTH);
}

export function isVideoShareCode(value: string) {
  return /^[A-Za-z0-9]{8,12}$/.test(value);
}
