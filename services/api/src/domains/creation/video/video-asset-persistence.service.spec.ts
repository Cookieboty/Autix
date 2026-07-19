// service 用 @autix/ai-adapters/core 的 safeFetch（内含真实 DNS 的 SSRF 校验，对
// provider.test 这种保留 TLD 必然 ENOTFOUND）。本用例只验 service 的下载/重试/上传
// 编排，把 safeFetch 换成直连 global.fetch 的薄封装即可（网络仍由各用例桩 global.fetch）；
// SSRF 网关本身由 @autix/ai-adapters 自己的测试覆盖。
vi.mock('@autix/ai-adapters/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@autix/ai-adapters/core')>()),
  safeFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

import { VideoAssetPersistenceService } from './video-asset-persistence.service';

function makeService() {
  const r2Service = {
    uploadBuffer: vi.fn(async () => ({ publicUrl: 'https://cdn.test/v.mp4' })),
  };
  const service = new VideoAssetPersistenceService(r2Service as never);

  return { service, r2Service };
}

describe('VideoAssetPersistenceService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads the provider video and uploads it to R2', async () => {
    const { service, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
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
        // key 按 generationId 定，不用随机名：回调与轮询并发收敛同一条 generation 时
        // 两边写同一个对象、覆盖而非各留一份（否则 generation 与素材库会指向两个
        // 内容相同的不同 key，还多一个孤儿对象）
        fileName: 'gen-1',
      },
    );

    global.fetch = originalFetch;
  });

  it('returns null after upload retries are exhausted', async () => {
    vi.useFakeTimers();
    vi.spyOn(global, 'setTimeout');
    const { service, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as never;

    const pending = service.persistProviderVideo(
      'https://provider.test/video.mp4',
      'gen-1',
    );
    // 驱动重试循环里的指数退避 setTimeout，并在每个定时器之间冲刷微任务
    // （async 循环 + 假时钟必须用 *Async 版本，否则定时器与 promise 互相等死）。
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(r2Service.uploadBuffer).not.toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});

describe('VideoAssetPersistenceService.persistProviderImage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('末帧走独立目录与 key 后缀，避免与视频本体撞名', async () => {
    const { service, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    await service.persistProviderImage('https://provider.test/last.png', 'gen-1');

    expect(r2Service.uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), {
      contentType: 'image/jpeg',
      folder: 'amux-studio/video-frames',
      ext: 'jpg',
      fileName: 'gen-1-last',
    });

    global.fetch = originalFetch;
  });

  it('并发重复转存落到同一个 key —— 这是不加锁也能保持一致的原因', async () => {
    const { service, r2Service } = makeService();
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as never;

    // 模拟回调与轮询同时收敛同一条 generation
    await Promise.all([
      service.persistProviderVideo('https://provider.test/video.mp4', 'gen-race'),
      service.persistProviderVideo('https://provider.test/video.mp4', 'gen-race'),
    ]);

    const fileNames = r2Service.uploadBuffer.mock.calls.map(
      (call: unknown[]) => (call[1] as { fileName?: string }).fileName,
    );
    expect(fileNames).toEqual(['gen-race', 'gen-race']);

    global.fetch = originalFetch;
  });
});
