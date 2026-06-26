import { Injectable } from '@nestjs/common';
import { OAuthProvider, RawTokenSet, NormalizedProfile } from '../provider.types';

/** Minimal stub — Task 5 will replace this with the full implementation. */
@Injectable()
export class GoogleProvider implements OAuthProvider {
  readonly name = 'google' as const;
  buildAuthorizeUrl(_i: { state: string; codeChallenge: string; nonce?: string; scope?: string }): string {
    throw new Error('Not implemented');
  }
  async exchangeCode(_i: { code: string; codeVerifier: string }): Promise<RawTokenSet> {
    throw new Error('Not implemented');
  }
  async fetchProfile(_tokens: RawTokenSet, _ctx?: { nonce?: string }): Promise<NormalizedProfile> {
    throw new Error('Not implemented');
  }
}
