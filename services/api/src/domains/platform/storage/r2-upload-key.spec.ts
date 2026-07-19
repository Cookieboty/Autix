import { PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudflareR2Service } from './cloudflare-r2.service';

/**
 * uploadBuffer 的 object key 拼装。
 *
 * fileName 是后加的：视频转存要按 generationId 落确定性 key，好让回调与轮询并发
 * 收敛同一条 generation 时写到同一个对象（覆盖而非各留一份）。但这里是拼 object key
 * 的地方 —— 即便调用方传的是内部 id，也必须挡住路径穿越，否则等于把口子开在存储层。
 */
function makeService(sent: unknown[]) {
  const service = new CloudflareR2Service({} as never);
  // 绕开真实配置/网络：只关心最终拼出来的 Key
  (service as unknown as { getRuntimeConfig: () => Promise<unknown> }).getRuntimeConfig =
    async () => ({
      client: { send: async (command: unknown) => void sent.push(command) },
      bucket: 'test-bucket',
      publicUrl: 'https://cdn.test',
    });
  return service;
}

async function keyOf(fileName: string | undefined) {
  const sent: unknown[] = [];
  const service = makeService(sent);
  const res = await service.uploadBuffer(Buffer.from([1]), {
    contentType: 'video/mp4',
    folder: 'amux-studio/video-generations',
    ext: 'mp4',
    ...(fileName === undefined ? {} : { fileName }),
  });
  const command = sent[0] as PutObjectCommand;
  return { key: command.input.Key as string, publicUrl: res.publicUrl };
}

describe('CloudflareR2Service.uploadBuffer — object key', () => {
  it('给了 fileName → 确定性 key（同一 generation 重复上传落同一个对象）', async () => {
    const a = await keyOf('gen-1');
    const b = await keyOf('gen-1');
    expect(a.key).toBe('amux-studio/video-generations/gen-1.mp4');
    expect(b.key).toBe(a.key);
    expect(a.publicUrl).toBe('https://cdn.test/amux-studio/video-generations/gen-1.mp4');
  });

  it('没给 fileName → 保持原来的随机名（其余调用方行为不变）', async () => {
    const a = await keyOf(undefined);
    const b = await keyOf(undefined);
    expect(a.key).toMatch(/^amux-studio\/video-generations\/\d+-[0-9a-f]{16}\.mp4$/);
    expect(b.key).not.toBe(a.key);
  });

  it('路径穿越与分隔符被剥掉，不会逃出 folder', async () => {
    const { key } = await keyOf('../../etc/passwd');
    expect(key).toBe('amux-studio/video-generations/....etcpasswd.mp4');
    expect(key.startsWith('amux-studio/video-generations/')).toBe(true);
  });

  it('过滤后为空 → 回退随机名，而不是拼出个裸扩展名的 key', async () => {
    const { key } = await keyOf('///');
    expect(key).not.toBe('amux-studio/video-generations/.mp4');
    expect(key).toMatch(/^amux-studio\/video-generations\/\d+-[0-9a-f]{16}\.mp4$/);
  });

  it('`..` 被整体拒绝（剥字符后恰好等于 .. 的情况）', async () => {
    const { key } = await keyOf('..');
    expect(key).toMatch(/^amux-studio\/video-generations\/\d+-[0-9a-f]{16}\.mp4$/);
  });
});
