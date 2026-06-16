import { ForbiddenException } from '@nestjs/common';
import { ChatFeatureGuard } from './chat-feature.guard';

describe('ChatFeatureGuard', () => {
  it('allows requests when the chat feature is enabled', async () => {
    const guard = new ChatFeatureGuard({
      getBoolean: jest.fn().mockResolvedValue(true),
    } as never);

    await expect(guard.canActivate({} as never)).resolves.toBe(true);
  });

  it('blocks requests when the chat feature is disabled', async () => {
    const guard = new ChatFeatureGuard({
      getBoolean: jest.fn().mockResolvedValue(false),
    } as never);

    await expect(guard.canActivate({} as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
