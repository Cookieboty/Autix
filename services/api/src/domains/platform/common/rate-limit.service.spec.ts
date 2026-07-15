import { RateLimitedException, RateLimitService } from './rate-limit.service';

function createRepository() {
  return {
    consume: vi.fn().mockResolvedValue({}),
    peek: vi.fn().mockResolvedValue({ blocked: false, retryAfterMs: 0 }),
  };
}

describe('RateLimitService', () => {
  it('does not call the repository for an empty dimension list', async () => {
    const repository = createRepository();
    const service = new RateLimitService(repository as any);
    await service.consume([]);
    expect(repository.consume).not.toHaveBeenCalled();
  });

  it('delegates all dimensions to one atomic repository operation', async () => {
    const repository = createRepository();
    const service = new RateLimitService(repository as any);
    const dimensions = [
      { key: 'action:user:u1', windowMs: 60_000, limit: 3 },
      { key: 'action:ip:hash', windowMs: 3_600_000, limit: 10 },
    ];
    await service.consume(dimensions);
    expect(repository.consume).toHaveBeenCalledWith(dimensions);
  });

  it('returns a generic 429 without exposing the blocked dimension key', async () => {
    const repository = createRepository();
    repository.consume.mockResolvedValueOnce({ blockedKey: 'action:user:u1', retryAfterMs: 42_000 });
    const service = new RateLimitService(repository as any);

    try {
      await service.consume([{ key: 'action:user:u1', windowMs: 60_000, limit: 1 }]);
      throw new Error('expected consume to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitedException);
      expect((error as RateLimitedException).getResponse()).toEqual({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        retryAfterMs: 42_000,
      });
    }
  });

  it('delegates peek without consuming capacity', async () => {
    const repository = createRepository();
    repository.peek.mockResolvedValueOnce({ blocked: true, retryAfterMs: 12_000 });
    const service = new RateLimitService(repository as any);
    const dimension = { key: 'peek:user:u1', windowMs: 60_000, limit: 2 };

    await expect(service.peek(dimension)).resolves.toEqual({ blocked: true, retryAfterMs: 12_000 });
    expect(repository.peek).toHaveBeenCalledWith(dimension);
    expect(repository.consume).not.toHaveBeenCalled();
  });
});
