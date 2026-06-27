import { SignJWT, importPKCS8 } from 'jose';

export type AppleSecretConfig = { teamId: string; keyId: string; clientId: string; privateKeyPem: string };
type Signer = (claims: Record<string, unknown>, header: { alg: 'ES256'; kid: string }) => Promise<string>;

export class AppleClientSecretFactory {
  constructor(
    private readonly config: AppleSecretConfig,
    private readonly signer: Signer = async (claims, header) => {
      const key = await importPKCS8(this.config.privateKeyPem, 'ES256');
      return new SignJWT(claims).setProtectedHeader(header).sign(key);
    },
  ) {}

  async create(now = Date.now()): Promise<string> {
    const iat = Math.floor(now / 1000);
    const claims = {
      iss: this.config.teamId, iat, exp: iat + 300,
      aud: 'https://appleid.apple.com', sub: this.config.clientId,
    };
    return this.signer(claims, { alg: 'ES256', kid: this.config.keyId });
  }
}
