import sharp from 'sharp';
import { AvatarImageProcessor } from './avatar-image-processor.service';

/**
 * T18: AvatarImageProcessor 单元 spec。
 *
 * 覆盖三条路径：
 * A. 正常处理：sharp 成功 → uploadBuffer 被调 → 返回 processed=true + 新 key/URL
 * B. 非图片降级：sharp 抛 "Input buffer contains unsupported image format" → 返回原 key + processed=false
 * C. sharp 内部异常降级：mock downloadObject 返回损坏 buffer → 走 catch 分支
 *
 * 边界策略：
 * - 空 body → fallback（processed=false）
 * - >5MB 源 → fallback（processed=false）
 */

function makeR2Stub() {
  return {
    downloadObject: vi.fn(),
    uploadBuffer: vi.fn(),
    getPublicUrl: vi.fn(async (key: string) => `https://cdn.mock.local/${key}`),
  } as any;
}

describe('T18: AvatarImageProcessor', () => {
  it('A. 正常处理：真实 sharp 生成 PNG → resize 到 512×512 WebP → uploadBuffer 得到新 key', async () => {
    const r2 = makeR2Stub();
    // 生成一张 1024×1024 纯色 PNG 作为源图
    const source = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .png()
      .toBuffer();
    r2.downloadObject.mockResolvedValue(source);
    r2.uploadBuffer.mockResolvedValue({
      publicUrl: 'https://cdn.mock.local/avatars/user-1/xyz.webp',
      key: 'avatars/user-1/xyz.webp',
    });

    const processor = new AvatarImageProcessor(r2);
    const result = await processor.processAndUpload('user-1', 'avatars/user-1/original.png');

    expect(result.processed).toBe(true);
    expect(result.storageKey).toBe('avatars/user-1/xyz.webp');
    expect(result.publicUrl).toBe('https://cdn.mock.local/avatars/user-1/xyz.webp');

    // 验证 uploadBuffer 收到的参数：contentType=webp、folder 强制 avatars/<uid>、ext=webp
    expect(r2.uploadBuffer).toHaveBeenCalledTimes(1);
    const [outputBuffer, opts] = r2.uploadBuffer.mock.calls[0];
    expect(opts.contentType).toBe('image/webp');
    expect(opts.folder).toBe('avatars/user-1');
    expect(opts.ext).toBe('webp');

    // 输出应该是有效 WebP，且尺寸==512×512
    const meta = await sharp(outputBuffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    // 输出体积应显著小于源图（1024 solid PNG > 512 WebP）
    expect(outputBuffer.byteLength).toBeLessThan(source.byteLength);
  });

  it('B. 非图片降级：downloadObject 返回文本 → sharp 抛错 → 回退到原 key、uploadBuffer 不被调用', async () => {
    const r2 = makeR2Stub();
    r2.downloadObject.mockResolvedValue(Buffer.from('this is not an image at all'));

    const processor = new AvatarImageProcessor(r2);
    const result = await processor.processAndUpload('user-1', 'avatars/user-1/broken.png');

    expect(result.processed).toBe(false);
    expect(result.storageKey).toBe('avatars/user-1/broken.png');
    expect(result.publicUrl).toBe('https://cdn.mock.local/avatars/user-1/broken.png');
    expect(r2.uploadBuffer).not.toHaveBeenCalled();
  });

  it('C. downloadObject 抛错 → 走 catch 分支，仍能安全降级', async () => {
    const r2 = makeR2Stub();
    r2.downloadObject.mockRejectedValue(new Error('R2 unreachable'));

    const processor = new AvatarImageProcessor(r2);
    const result = await processor.processAndUpload('user-1', 'avatars/user-1/x.png');

    expect(result.processed).toBe(false);
    expect(result.storageKey).toBe('avatars/user-1/x.png');
    expect(r2.uploadBuffer).not.toHaveBeenCalled();
  });

  it('D. 空 body 降级：downloadObject 返回长度 0 → fallback', async () => {
    const r2 = makeR2Stub();
    r2.downloadObject.mockResolvedValue(Buffer.alloc(0));

    const processor = new AvatarImageProcessor(r2);
    const result = await processor.processAndUpload('user-1', 'avatars/user-1/empty.png');

    expect(result.processed).toBe(false);
    expect(result.storageKey).toBe('avatars/user-1/empty.png');
    expect(r2.uploadBuffer).not.toHaveBeenCalled();
  });

  it('E. 超大源图降级：>5MB → 直接 fallback，不下载到 sharp', async () => {
    const r2 = makeR2Stub();
    // 6MB fake buffer
    r2.downloadObject.mockResolvedValue(Buffer.alloc(6 * 1024 * 1024, 0xff));

    const processor = new AvatarImageProcessor(r2);
    const result = await processor.processAndUpload('user-1', 'avatars/user-1/huge.png');

    expect(result.processed).toBe(false);
    expect(result.storageKey).toBe('avatars/user-1/huge.png');
    expect(r2.uploadBuffer).not.toHaveBeenCalled();
  });
});
