import { ForbiddenException } from '@nestjs/common';
import { LibraryFeatureGuard } from './library-feature.guard';

describe('LibraryFeatureGuard', () => {
  it('allows requests when the library feature is enabled', async () => {
    const guard = new LibraryFeatureGuard({
      getBoolean: vi.fn().mockResolvedValue(true),
    } as never);

    await expect(guard.canActivate({} as never)).resolves.toBe(true);
  });

  it('blocks requests when the library feature is disabled', async () => {
    const guard = new LibraryFeatureGuard({
      getBoolean: vi.fn().mockResolvedValue(false),
    } as never);

    await expect(guard.canActivate({} as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
