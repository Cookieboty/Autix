import { VideoAssetPersistenceService } from './video-asset-persistence.service';

function makeService() {
  const r2Service = {
    uploadBuffer: jest.fn(async () => ({ publicUrl: 'https://cdn.test/v.mp4' })),
  };
  const service = new VideoAssetPersistenceService(r2Service as never);

  return { service, r2Service };
}

describe('VideoAssetPersistenceService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('downloads the provider video and uploads it to R2', async () => {
    const { service, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    const result = await service.persistProviderVideo(
      'https://provider.test/video.mp4',
      'gen-1',
    );

    expect(result).toBe('https://cdn.test/v.mp4');
    expect(r2Service.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      {
        contentType: 'video/mp4',
        folder: 'amux-studio/video-generations',
        ext: 'mp4',
      },
    );

    global.fetch = originalFetch;
  });

  it('returns null after upload retries are exhausted', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    const { service, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as never;

    const pending = service.persistProviderVideo(
      'https://provider.test/video.mp4',
      'gen-1',
    );
    await Promise.resolve();
    jest.runAllTimers();
    await Promise.resolve();
    jest.runAllTimers();

    await expect(pending).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(r2Service.uploadBuffer).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});
