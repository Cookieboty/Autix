import {
  assertInStationMediaUrls,
  assertSource,
  assertTransition,
  isInStationMediaUrl,
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

  it('ADMIN_CURATED 已删除来源：不再是合法 sourceType，任何角色均抛错（走 default 分支）', () => {
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'ADMIN_CURATED' }, 'admin'),
    ).toThrow();
    expect(() =>
      assertSource({ kind: 'IMAGE', sourceType: 'ADMIN_CURATED' }, 'author'),
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
    ).toThrow('仅允许使用站内存储的媒体链接');
  });
});
