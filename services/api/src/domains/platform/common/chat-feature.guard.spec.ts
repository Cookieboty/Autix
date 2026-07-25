import { ChatFeatureGuard } from './chat-feature.guard';

describe('ChatFeatureGuard', () => {
  it('allows requests when the chat feature is enabled', async () => {
    const guard = new ChatFeatureGuard({
      getBoolean: vi.fn().mockResolvedValue(true),
    } as never);

    await expect(guard.canActivate({} as never)).resolves.toBe(true);
  });

  it('blocks requests when the chat feature is disabled', async () => {
    const guard = new ChatFeatureGuard({
      getBoolean: vi.fn().mockResolvedValue(false),
    } as never);

    await expect(guard.canActivate({} as never)).rejects.toMatchObject({ status: 403 });
  });
});
