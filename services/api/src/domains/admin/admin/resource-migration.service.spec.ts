import { ResourceMigrationService } from './resource-migration.service';
import { assertSource, isHttpUrl } from '../../creation/gallery/gallery.helpers';

function makeR2() {
  const calls: Array<{ folder?: string; ext?: string; contentType: string }> = [];
  const r2 = {
    calls,
    uploadBuffer: async (
      _buffer: Buffer,
      opts: { contentType: string; folder?: string; ext?: string },
    ) => {
      calls.push(opts);
      return {
        publicUrl: `https://cdn.test/${opts.folder ?? 'root'}.${opts.ext ?? 'bin'}`,
        key: `${opts.folder}/file.${opts.ext}`,
      };
    },
    getPublicBaseUrl: async () => 'https://cdn.test',
  };
  return r2;
}

/** fetch mock: any url containing "bad" fails, others succeed with the given content-type. */
function mockFetch(contentType = 'image/png') {
  return (async (url: string) => {
    if (String(url).includes('bad')) {
      return { ok: false, status: 404 } as any;
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    } as any;
  }) as unknown as typeof fetch;
}

describe('ResourceMigrationService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('isUrl', () => {
    const svc = new ResourceMigrationService(makeR2() as any);

    it('accepts http and https URLs', () => {
      expect(svc.isUrl('https://example.com/a.png')).toBe(true);
      expect(svc.isUrl('http://example.com/a.png')).toBe(true);
    });

    it('rejects non-URL strings', () => {
      expect(svc.isUrl('hello world')).toBe(false);
      expect(svc.isUrl('ftp://example.com/a.png')).toBe(false);
      expect(svc.isUrl('')).toBe(false);
    });
  });

  describe('migrateUrl', () => {
    it('downloads and re-uploads, returning the R2 public URL', async () => {
      globalThis.fetch = mockFetch('image/png');
      const r2 = makeR2();
      const svc = new ResourceMigrationService(r2 as any);

      const result = await svc.migrateUrl('https://example.com/a.png', 'folder/cover');

      expect(result).toBe('https://cdn.test/folder/cover.png');
      expect(r2.calls[0]).toMatchObject({ folder: 'folder/cover', ext: 'png' });
    });

    it('throws when the download fails', async () => {
      globalThis.fetch = mockFetch();
      const svc = new ResourceMigrationService(makeR2() as any);
      await expect(svc.migrateUrl('https://example.com/bad.png', 'folder')).rejects.toThrow();
    });
  });

  describe('migrateTemplateData', () => {
    it('migrates string URLs, array URLs and nested object URLs', async () => {
      globalThis.fetch = mockFetch('image/jpeg');
      const svc = new ResourceMigrationService(makeR2() as any);

      const input = {
        title: 'Plain title',
        coverImage: 'https://example.com/cover.jpg',
        exampleImages: ['https://example.com/1.jpg', 'not-a-url'],
        nested: { avatar: 'https://example.com/avatar.jpg', name: 'keep me' },
        pointsCost: 10,
      };

      const { data, errors } = await svc.migrateTemplateData(input, 'batch/0');

      expect(errors).toHaveLength(0);
      expect(data.title).toBe('Plain title');
      expect(data.coverImage).toContain('https://cdn.test');
      expect((data.exampleImages as string[])[0]).toContain('https://cdn.test');
      expect((data.exampleImages as string[])[1]).toBe('not-a-url');
      expect((data.nested as any).avatar).toContain('https://cdn.test');
      expect((data.nested as any).name).toBe('keep me');
      expect(data.pointsCost).toBe(10);
    });

    it('records errors and keeps the original URL when a download fails', async () => {
      globalThis.fetch = mockFetch();
      const svc = new ResourceMigrationService(makeR2() as any);

      const input = {
        coverImage: 'https://example.com/bad-cover.png',
        exampleImages: ['https://example.com/good.png', 'https://example.com/bad-2.png'],
      };

      const { data, errors } = await svc.migrateTemplateData(input, 'batch/1');

      expect(data.coverImage).toBe('https://example.com/bad-cover.png');
      expect((data.exampleImages as string[])[0]).toContain('https://cdn.test');
      expect((data.exampleImages as string[])[1]).toBe('https://example.com/bad-2.png');
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('migrateMediaFields', () => {
    it('migrates only media fields and preserves reference URLs', async () => {
      globalThis.fetch = mockFetch('image/png');
      const svc = new ResourceMigrationService(makeR2() as any);

      const input = {
        title: 'Keep',
        coverImage: 'https://example.com/cover.png',
        exampleImages: ['https://example.com/1.png'],
        exampleMedia: ['https://example.com/clip.png'],
        originalUrl: 'https://x.com/some/status/123',
        authorUrl: 'https://x.com/author',
        externalMetadata: { source_url: 'https://x.com/some/status/123' },
      };

      const { data, errors } = await svc.migrateMediaFields(input, 'batch/0');

      expect(errors).toHaveLength(0);
      expect(data.coverImage).toContain('https://cdn.test');
      expect((data.exampleImages as string[])[0]).toContain('https://cdn.test');
      expect((data.exampleMedia as string[])[0]).toContain('https://cdn.test');
      // reference URLs untouched
      expect(data.originalUrl).toBe('https://x.com/some/status/123');
      expect(data.authorUrl).toBe('https://x.com/author');
      expect((data.externalMetadata as any).source_url).toBe(
        'https://x.com/some/status/123',
      );
    });
  });

  describe('ResourceMigrationService.migrateMediaFields — 幂等', () => {
    function makeSvc() {
      const r2 = { getPublicBaseUrl: async () => 'https://cdn.test' };
      return new ResourceMigrationService(r2 as never);
    }

    it('跳过已站内化的 URL，只搬外链', async () => {
      const svc = makeSvc();
      const migrated: string[] = [];
      vi.spyOn(svc, 'migrateUrl').mockImplementation(async (url: string) => {
        migrated.push(url);
        return 'https://cdn.test/new.png';
      });

      const { data, errors } = await svc.migrateMediaFields(
        {
          coverImage: 'https://cdn.test/already.png',
          mediaUrls: ['https://cdn.test/done.png', 'https://ext.example/a.png'],
        },
        'gallery/p1',
        ['coverImage', 'mediaUrls'],
      );

      expect(migrated).toEqual(['https://ext.example/a.png']);
      expect(data.coverImage).toBe('https://cdn.test/already.png');
      expect(data.mediaUrls).toEqual(['https://cdn.test/done.png', 'https://cdn.test/new.png']);
      expect(errors).toEqual([]);
    });

    it('全部已站内化时不发起任何搬运', async () => {
      const svc = makeSvc();
      const spy = vi.spyOn(svc, 'migrateUrl');
      const { errors } = await svc.migrateMediaFields(
        { coverImage: 'https://cdn.test/a.png', mediaUrls: ['https://cdn.test/b.png'] },
        'gallery/p2',
        ['coverImage', 'mediaUrls'],
      );
      expect(spy).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
    });

    // Fix 1b（纵深防御）：非空但非法 http(s) URL 的媒体值此前被 needsMigration 的
    // isUrl 判定原样跳过、不 push error —— 于是 errors.length===0，worker 把它当
    // "搬运成功"写 mediaMigrated=true 并自动发布，即便这条媒体从未被搬运/校验过。
    it('非法字符串（非 URL）媒体值：不发起搬运，但必须 push error，不能静默放行', async () => {
      const svc = makeSvc();
      const spy = vi.spyOn(svc, 'migrateUrl');

      const { data, errors } = await svc.migrateMediaFields(
        { coverImage: 'garbage', mediaUrls: ['garbage', 'ftp://ext.example/a.png'] },
        'gallery/p3',
        ['coverImage', 'mediaUrls'],
      );

      expect(spy).not.toHaveBeenCalled();
      expect(data.coverImage).toBe('garbage');
      expect(data.mediaUrls).toEqual(['garbage', 'ftp://ext.example/a.png']);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.some((e) => e.startsWith('coverImage'))).toBe(true);
      expect(errors.some((e) => e.startsWith('mediaUrls[0]'))).toBe(true);
      expect(errors.some((e) => e.startsWith('mediaUrls[1]'))).toBe(true);
    });

    it('null / 空串媒体值：跳过且不报错（coverImage 可以为 null）', async () => {
      const svc = makeSvc();
      const spy = vi.spyOn(svc, 'migrateUrl');

      const { data, errors } = await svc.migrateMediaFields(
        { coverImage: null, mediaUrls: [] },
        'gallery/p4',
        ['coverImage', 'mediaUrls'],
      );

      expect(spy).not.toHaveBeenCalled();
      expect(data.coverImage).toBeNull();
      expect(errors).toEqual([]);
    });
  });

  // ── URL 判定同源性：导入侧（assertSource）与 worker 侧（migrateMediaFields）
  // 曾各写一套 URL 合法性判定——assertSource 用 gallery.helpers 里模块私有的
  // isHttpUrl（WHATWG new URL()，大小写不敏感），resource-migration.service 用
  // isUrl（大小写敏感正则 /^https?:\/\/.+/）。真实分歧样本：`HTTP://x/a.png`——
  // 修复前导入侧放行、worker 侧判定不合法，作品的 mediaMigrated 永远搬不成功，
  // 卡死在 PENDING（管理员只在日志里看到一行 warn）。收敛后两侧必须一致接受/拒绝。
  describe('URL 判定同源性（导入侧 assertSource vs worker 侧 migrateMediaFields）', () => {
    function makeIdempotentSvc() {
      // base 用一个不会与下方任何样本 host 撞上的域名，确保命中"需要搬运"分支
      // 而非"已站内跳过"分支——我们要测的是"是否判定为合法 URL"，不是幂等跳过。
      const r2 = { getPublicBaseUrl: async () => 'https://cdn.test' };
      return new ResourceMigrationService(r2 as never);
    }

    function importSideAccepts(url: string): boolean {
      try {
        assertSource(
          { kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: [url] },
          'admin',
        );
        return true;
      } catch {
        return false;
      }
    }

    async function workerSideAccepts(url: string): Promise<boolean> {
      const svc = makeIdempotentSvc();
      vi.spyOn(svc, 'migrateUrl').mockResolvedValue('https://cdn.test/new.png');
      const { errors } = await svc.migrateMediaFields(
        { mediaUrls: [url] },
        'gallery/homogeneity',
        ['mediaUrls'],
      );
      return errors.length === 0;
    }

    const cases: Array<[label: string, url: string, accept: boolean]> = [
      ['标准 https', 'https://example.com/a.png', true],
      ['标准 http', 'http://example.com/a.png', true],
      // 真实分歧样本：大写 scheme。
      ['大写 scheme（真实分歧样本）', 'HTTP://x/a.png', true],
      ['大写 host+path 混合大小写', 'HTTPS://EXAMPLE.com/A.png', true],
      ['首尾空白', '  https://x/a.png  ', true],
      ['单斜杠 https:/x（WHATWG 规范化）', 'https:/x/a.png', true],
      ['非 http(s) 协议', 'ftp://example.com/a.png', false],
      ['非 URL 字符串', 'garbage', false],
      ['javascript: 协议', 'javascript:alert(1)', false],
      ['相对路径（无 base 无法解析）', '/relative/path.png', false],
    ];

    it.each(cases)('%s: %s → 两侧一致（accept=%s）', async (_label, url, accept) => {
      expect(importSideAccepts(url)).toBe(accept);
      expect(await workerSideAccepts(url)).toBe(accept);
    });

    it('大写 scheme HTTP://x/a.png：修复前导入侧放行/worker 侧拒绝，修复后两侧都必须接受', async () => {
      const url = 'HTTP://x/a.png';
      expect(importSideAccepts(url)).toBe(true);
      expect(await workerSideAccepts(url)).toBe(true);
      // 与暴露的两个判定函数本身也应一致（收敛到同一实现的直接证据）。
      expect(isHttpUrl(url)).toBe(true);
      expect(new ResourceMigrationService({ getPublicBaseUrl: async () => null } as never).isUrl(url)).toBe(true);
    });
  });
});
