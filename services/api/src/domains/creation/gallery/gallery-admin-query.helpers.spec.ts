import {
  ADMIN_GALLERY_DEFAULT_PAGE_SIZE,
  ADMIN_GALLERY_MAX_PAGE_SIZE,
  buildAdminGalleryWhere,
  normalizeAdminGalleryQuery,
} from './gallery.helpers';

describe('normalizeAdminGalleryQuery', () => {
  it('缺省值：无 status/kind、externalOnly=false、page=1、pageSize=默认', () => {
    const q = normalizeAdminGalleryQuery({});
    expect(q).toEqual({
      status: undefined,
      kind: undefined,
      category: undefined,
      sourceType: undefined,
      search: undefined,
      externalOnly: false,
      page: 1,
      pageSize: ADMIN_GALLERY_DEFAULT_PAGE_SIZE,
    });
  });

  it('非法枚举回退 undefined，合法枚举保留', () => {
    expect(normalizeAdminGalleryQuery({ status: 'BOGUS', kind: 'gif' }).status).toBeUndefined();
    expect(normalizeAdminGalleryQuery({ kind: 'gif' }).kind).toBeUndefined();
    const q = normalizeAdminGalleryQuery({ status: 'PUBLISHED', kind: 'VIDEO', sourceType: 'ADMIN_CURATED' });
    expect(q.status).toBe('PUBLISHED');
    expect(q.kind).toBe('VIDEO');
    expect(q.sourceType).toBe('ADMIN_CURATED');
  });

  it('page 至少为 1，pageSize 夹在 1..100', () => {
    expect(normalizeAdminGalleryQuery({ page: 0 }).page).toBe(1);
    expect(normalizeAdminGalleryQuery({ page: -5 }).page).toBe(1);
    expect(normalizeAdminGalleryQuery({ page: '3' }).page).toBe(3);
    expect(normalizeAdminGalleryQuery({ pageSize: 999 }).pageSize).toBe(ADMIN_GALLERY_MAX_PAGE_SIZE);
    expect(normalizeAdminGalleryQuery({ pageSize: 0 }).pageSize).toBe(ADMIN_GALLERY_DEFAULT_PAGE_SIZE);
  });

  it('category/search 去空白，空串归 undefined；externalOnly 接受 true/"true"/"1"', () => {
    expect(normalizeAdminGalleryQuery({ category: '  ', search: '' }).category).toBeUndefined();
    expect(normalizeAdminGalleryQuery({ category: ' Art ' }).category).toBe('Art');
    expect(normalizeAdminGalleryQuery({ search: ' cat ' }).search).toBe('cat');
    expect(normalizeAdminGalleryQuery({ externalOnly: 'true' }).externalOnly).toBe(true);
    expect(normalizeAdminGalleryQuery({ externalOnly: '1' }).externalOnly).toBe(true);
    expect(normalizeAdminGalleryQuery({ externalOnly: 'no' }).externalOnly).toBe(false);
  });
});

describe('buildAdminGalleryWhere', () => {
  const base = normalizeAdminGalleryQuery({});

  it('未指定 status 时排除 REMOVED', () => {
    const where = buildAdminGalleryWhere(base, null);
    expect(where.status).toEqual({ not: 'REMOVED' });
  });

  it('指定 status 精确过滤', () => {
    const where = buildAdminGalleryWhere({ ...base, status: 'PENDING' }, null);
    expect(where.status).toBe('PENDING');
  });

  it('kind/category/sourceType/search 拼进 where', () => {
    const where = buildAdminGalleryWhere(
      { ...base, kind: 'IMAGE', category: 'Art', sourceType: 'USER_UPLOAD', search: 'cat' },
      null,
    );
    expect(where.kind).toBe('IMAGE');
    expect(where.category).toBe('Art');
    expect(where.sourceType).toBe('USER_UPLOAD');
    expect(where.title).toEqual({ contains: 'cat', mode: 'insensitive' });
  });

  it('externalOnly 且有 R2 域名：coverImage 非空且不以该域名开头', () => {
    const where = buildAdminGalleryWhere({ ...base, externalOnly: true }, 'https://cdn.mine.com');
    expect(where.AND).toEqual([
      { coverImage: { not: null } },
      { NOT: { coverImage: { startsWith: 'https://cdn.mine.com' } } },
    ]);
  });

  it('externalOnly 但 R2 域名缺失：不加该过滤（无从判断）', () => {
    const where = buildAdminGalleryWhere({ ...base, externalOnly: true }, null);
    expect(where.AND).toBeUndefined();
  });
});
