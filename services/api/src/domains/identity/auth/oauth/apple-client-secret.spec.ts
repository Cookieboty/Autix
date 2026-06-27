import { AppleClientSecretFactory } from './apple-client-secret';

describe('AppleClientSecretFactory', () => {
  it('用注入 signer 生成正确 claims/header', async () => {
    const captured: any = {};
    const signer = async (claims: any, header: any) => { captured.claims = claims; captured.header = header; return 'SIGNED'; };
    const f = new AppleClientSecretFactory(
      { teamId: 'TEAM', keyId: 'KEY', clientId: 'com.x.svc', privateKeyPem: 'pem' }, signer,
    );
    const secret = await f.create(1_000_000);
    expect(secret).toBe('SIGNED');
    expect(captured.header).toEqual({ alg: 'ES256', kid: 'KEY' });
    expect(captured.claims).toEqual(expect.objectContaining({
      iss: 'TEAM', sub: 'com.x.svc', aud: 'https://appleid.apple.com', iat: 1000, exp: 1300,
    }));
  });
});
