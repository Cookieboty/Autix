import {
  createVideoShareToken,
  verifyVideoShareToken,
} from './video-share-token';

describe('video share token', () => {
  it('round-trips signed project payloads', () => {
    const token = createVideoShareToken(
      { projectId: 'project-1', userId: 'user-1', issuedAt: 123 },
      'secret',
    );

    expect(verifyVideoShareToken(token, 'secret')).toEqual({
      version: 1,
      projectId: 'project-1',
      userId: 'user-1',
      issuedAt: 123,
    });
  });

  it('rejects tampered or incorrectly signed tokens', () => {
    const token = createVideoShareToken(
      { projectId: 'project-1', userId: 'user-1', issuedAt: 123 },
      'secret',
    );
    const [payload, signature] = token.split('.');

    expect(verifyVideoShareToken(`${payload}.${signature}x`, 'secret')).toBeNull();
    expect(verifyVideoShareToken(token, 'other-secret')).toBeNull();
    expect(verifyVideoShareToken('not-a-token', 'secret')).toBeNull();
  });
});
