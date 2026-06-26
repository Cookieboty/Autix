import * as crypto from 'crypto';

export class TokenCipher {
  private readonly key: Buffer;
  constructor(hexKey = process.env.OAUTH_TOKEN_ENC_KEY ?? '') {
    if (hexKey.length !== 64) throw new Error('OAUTH_TOKEN_ENC_KEY must be 32-byte hex');
    this.key = Buffer.from(hexKey, 'hex');
  }
  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
  }
  decrypt(payload: string): string {
    const [iv, tag, enc] = payload.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8');
  }
}
