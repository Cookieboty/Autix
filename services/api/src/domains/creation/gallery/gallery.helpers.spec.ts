import { GalleryStatus } from '../../platform/prisma/generated';
import {
  assertInStationMediaUrls,
  assertSource,
  assertTransition,
  isInStationMediaUrl,
  type GallerySourcePayload,
} from './gallery.helpers';

describe('assertTransition (§5.1.1 状态机)', () => {
  it('作者可 DRAFT→PENDING、REJECTED→PENDING', () => {
    expect(() => assertTransition('DRAFT', 'PENDING', 'author')).not.toThrow();
    expect(() =>
      assertTransition('REJECTED', 'PENDING', 'author'),
    ).not.toThrow();
  });

  it('仅管理员可 PENDING→PUBLISHED；作者不行', () => {
    expect(() =>
      assertTransition('PENDING', 'PUBLISHED', 'admin'),
    ).not.toThrow();
    expect(() => assertTransition('PENDING', 'PUBLISHED', 'author')).toThrow();
  });

  it('系统风控与管理员可 PENDING→REJECTED、PUBLISHED→HIDDEN', () => {
    expect(() =>
      assertTransition('PENDING', 'REJECTED', 'system'),
    ).not.toThrow();
    expect(() =>
      assertTransition('PUBLISHED', 'HIDDEN', 'system'),
    ).not.toThrow();
  });

  it('非法转移抛错（如 PUBLISHED→PENDING）', () => {
    expect(() => assertTransition('PUBLISHED', 'PENDING', 'admin')).toThrow();
  });

  it('I5：作者可删除自己尚未发布的 DRAFT/PENDING/REJECTED 作品', () => {
    expect(() => assertTransition('DRAFT', 'REMOVED', 'author')).not.toThrow();
    expect(() => assertTransition('PENDING', 'REMOVED', 'author')).not.toThrow();
    expect(() => assertTransition('REJECTED', 'REMOVED', 'author')).not.toThrow();
  });

  it('作者 republish 仅接受 UNPUBLISHED，拒绝 HIDDEN', () => {
    expect(() => assertTransition('UNPUBLISHED', 'PENDING', 'author')).not.toThrow();
    expect(() => assertTransition('HIDDEN', 'PENDING', 'author')).toThrow(); // 防逃避处罚
  });

  it('作者 unpublish PUBLISHED→UNPUBLISHED；unhide 仅 admin HIDDEN→PUBLISHED', () => {
    expect(() => assertTransition('PUBLISHED', 'UNPUBLISHED', 'author')).not.toThrow();
    expect(() => assertTransition('HIDDEN', 'PUBLISHED', 'admin')).not.toThrow();
    expect(() => assertTransition('HIDDEN', 'PUBLISHED', 'author')).toThrow();
  });
});

describe('assertSource (§6.4 来源强校验)', () => {
  it('USER_UPLOAD：必须有 mediaUrls，且不带模板/生成引用', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'USER_UPLOAD', mediaUrls: ['a.png'] },
        'author',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'USER_UPLOAD',
          mediaUrls: ['a.png'],
          imageTemplateId: 't1',
        },
        'author',
      ),
    ).toThrow();
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'USER_UPLOAD' }, 'author'),
    ).toThrow();
  });

  it('FROM_GENERATION：需与 kind 一致的单一 generationId', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'FROM_GENERATION',
          imageGenerationId: 'g1',
        },
        'author',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'FROM_GENERATION',
          videoGenerationId: 'g1',
        },
        'author',
      ),
    ).toThrow();
  });

  it('M1：FROM_GENERATION 不允许携带模板引用（与 FROM_TEMPLATE 对称）', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'FROM_GENERATION',
          imageGenerationId: 'g1',
          imageTemplateId: 't1',
        },
        'author',
      ),
    ).toThrow();
  });

  it('FROM_TEMPLATE：需模板引用、禁生成引用', () => {
    expect(() =>
      assertSource(
        { kind: 'VIDEO', sourceType: 'FROM_TEMPLATE', videoTemplateId: 't1' },
        'author',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'VIDEO',
          sourceType: 'FROM_TEMPLATE',
          videoTemplateId: 't1',
          videoGenerationId: 'g1',
        },
        'author',
      ),
    ).toThrow();
  });

  it('M1：未知 sourceType 兜底抛错（default 分支）', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'UNKNOWN' as never },
        'author',
      ),
    ).toThrow();
  });
});

describe('isInStationMediaUrl / assertInStationMediaUrls（Task 4.5：站内来源写入守卫）', () => {
  const base = 'https://cdn.mine.com';

  it('命中站内域名（origin 精确匹配）→ true', () => {
    expect(isInStationMediaUrl('https://cdn.mine.com/a.png', [base])).toBe(true);
  });

  it('非站内域名 → false', () => {
    expect(isInStationMediaUrl('https://evil.com/x.png', [base])).toBe(false);
  });

  it('防前缀绕过：https://cdn.mine.com.evil.com 字符串以 base 开头但 host 不同 → false', () => {
    expect(isInStationMediaUrl('https://cdn.mine.com.evil.com/x.png', [base])).toBe(false);
  });

  it('协议不同（http vs https）→ false', () => {
    expect(isInStationMediaUrl('http://cdn.mine.com/a.png', [base])).toBe(false);
  });

  it('无效 URL / 空 base → false', () => {
    expect(isInStationMediaUrl('not-a-url', [base])).toBe(false);
    expect(isInStationMediaUrl('https://cdn.mine.com/a.png', [null, undefined, ''])).toBe(false);
  });

  it('assertInStationMediaUrls：全部命中不抛错；任意一个非站内 → BadRequestException', () => {
    expect(() =>
      assertInStationMediaUrls(['https://cdn.mine.com/a.png', 'https://cdn.mine.com/b.png'], [base]),
    ).not.toThrow();
    expect(() =>
      assertInStationMediaUrls(['https://cdn.mine.com/a.png', 'https://evil.com/x.png'], [base]),
    ).toThrow('only media links stored on our platform are allowed');
  });
});

describe('assertTransition —— UNPUBLISHED 出边', () => {
  it('作者可以删除自己已下架的作品（UNPUBLISHED → REMOVED）', () => {
    expect(() =>
      assertTransition(GalleryStatus.UNPUBLISHED, GalleryStatus.REMOVED, 'author'),
    ).not.toThrow();
  });

  it('HIDDEN 仍不可由作者直接改回 PUBLISHED（防绕过管理员处罚）', () => {
    expect(() =>
      assertTransition(GalleryStatus.HIDDEN, GalleryStatus.PUBLISHED, 'author'),
    ).toThrow();
  });
});

describe('assertSource — ADMIN_CURATED（管理端导入）', () => {
  it('接受带 mediaUrls 的合法导入 payload', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: ['https://ext/a.png'] },
        'admin',
      ),
    ).not.toThrow();
  });

  it('拒绝空 mediaUrls', () => {
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: [] }, 'admin'),
    ).toThrow('ADMIN_CURATED requires mediaUrls');
  });

  it('拒绝携带模板引用', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['https://ext/a.png'],
          imageTemplateId: 't1',
        },
        'admin',
      ),
    ).toThrow('ADMIN_CURATED must not carry template/generation references');
  });

  it('拒绝携带生成引用', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['https://ext/a.png'],
          imageGenerationId: 'g1',
        },
        'admin',
      ),
    ).toThrow('ADMIN_CURATED must not carry template/generation references');
  });

  // Fix 1a：非 URL 的 mediaUrls 条目不能在导入时蒙混过关（否则会被迁移 worker
  // 静默跳过，errors 为空，进而 mediaMigrated=true 被自动发布——见 final-fixes 审查）。
  it('拒绝 mediaUrls 中任意一条不是 http(s) URL（纯字符串校验，非法值应在导入时就拒绝）', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: ['garbage'] },
        'admin',
      ),
    ).toThrow(/mediaUrls/);
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['https://ext/a.png', 'ftp://ext/b.png'],
        },
        'admin',
      ),
    ).toThrow(/mediaUrls/);
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['javascript:alert(1)'],
        },
        'admin',
      ),
    ).toThrow(/mediaUrls/);
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: ['/relative/path.png'] },
        'admin',
      ),
    ).toThrow(/mediaUrls/);
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: [''] },
        'admin',
      ),
    ).toThrow(/mediaUrls/);
  });

  it('coverImage 若提供且非空，也必须是 http(s) URL', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['https://ext/a.png'],
          coverImage: 'garbage',
        } as GallerySourcePayload,
        'admin',
      ),
    ).toThrow(/coverImage/);
  });

  it('coverImage 缺省或空字符串（模板默认值）不触发校验', () => {
    expect(() =>
      assertSource(
        { kind: 'IMAGE', sourceType: 'ADMIN_CURATED', mediaUrls: ['https://ext/a.png'] },
        'admin',
      ),
    ).not.toThrow();
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['https://ext/a.png'],
          coverImage: '',
        } as GallerySourcePayload,
        'admin',
      ),
    ).not.toThrow();
  });

  it('coverImage 合法 URL 时通过', () => {
    expect(() =>
      assertSource(
        {
          kind: 'IMAGE',
          sourceType: 'ADMIN_CURATED',
          mediaUrls: ['https://ext/a.png'],
          coverImage: 'https://ext/cover.png',
        } as GallerySourcePayload,
        'admin',
      ),
    ).not.toThrow();
  });
});
