import {
  GalleryStatus,
  ResourceType,
  TemplateStatus,
} from '../../platform/prisma/generated';
import { BatchJobRepository } from './batch-job.repository';
import { BatchJobService } from './batch-job.service';

interface TplRecord {
  id: string;
  status?: string;
  rejectReason?: string | null;
  publishedAt?: Date | null;
  [k: string]: unknown;
}

function makeMockPrisma() {
  const jobs = new Map<string, any>();
  const imageStore = new Map<string, TplRecord>();
  const galleryStore = new Map<string, TplRecord>();
  let jobSeq = 0;

  const tplDelegate = (store: Map<string, TplRecord>) => ({
    create: async ({ data }: { data: any }) => {
      const id = `tpl-${store.size + 1}`;
      const rec = { id, ...data };
      store.set(id, rec);
      return rec;
    },
    findFirst: async ({ where, select }: { where: any; select?: any }) => {
      for (const rec of store.values()) {
        const match = Object.entries(where).every(([k, v]) => rec[k] === v);
        if (match) return select ? Object.fromEntries(Object.keys(select).map(k => [k, rec[k]])) : rec;
      }
      return null;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const rec = store.get(where.id);
      if (!rec) throw new Error(`not found: ${where.id}`);
      Object.assign(rec, data);
      return rec;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      if (!store.has(where.id)) throw new Error(`not found: ${where.id}`);
      store.delete(where.id);
      return { id: where.id };
    },
  });

  const prisma = {
    _jobs: jobs,
    _imageStore: imageStore,
    _galleryStore: galleryStore,
    gallery_posts: {
      create: async ({ data }: { data: any }) => {
        const id = `gallery-${galleryStore.size + 1}`;
        const rec = { id, ...data };
        galleryStore.set(id, rec);
        return rec;
      },
    },
    batch_jobs: {
      create: async ({ data }: { data: any }) => {
        const id = `job-${++jobSeq}`;
        const job = { id, processed: 0, failed: 0, total: 0, ...data };
        jobs.set(id, job);
        return job;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const job = jobs.get(where.id);
        Object.assign(job, data);
        return job;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        jobs.get(where.id) ?? null,
      findMany: async () => [...jobs.values()],
      count: async () => jobs.size,
    },
    user: {
      findUnique: async () => ({ username: 'admin', realName: 'Admin User', avatar: null }),
    },
    image_templates: tplDelegate(imageStore),
    video_templates: tplDelegate(new Map()),
  };
  return prisma;
}

const noopSse = { emit: async () => undefined };

function makeService(overrides?: { prisma?: any }) {
  const prisma = overrides?.prisma ?? makeMockPrisma();
  const repository = new BatchJobRepository(prisma as any);
  const service = new BatchJobService(repository, noopSse as any, prisma as any);
  return { service, prisma };
}

describe('BatchJobService', () => {
  it('createAndProcess persists a job and returns its id', async () => {
    const { service, prisma } = makeService();
    const { jobId } = await service.createAndProcess(
      'user-1',
      'IMPORT',
      ResourceType.IMAGE_TEMPLATE,
      { items: [{ title: 'A' }] },
    );
    expect(jobId).toBeTruthy();
    const job = await prisma.batch_jobs.findUnique({ where: { id: jobId } });
    expect(job.userId).toBe('user-1');
    expect(job.total).toBe(1);
  });

  it('processImport rejects non-gallery resource types (template import removed)', async () => {
    const { service, prisma } = makeService();
    prisma._jobs.set('job-x', { id: 'job-x' });

    await (service as any).processImport('job-x', ResourceType.IMAGE_TEMPLATE, 'user-1', [
      { title: 'A' },
      { title: 'B' },
    ]);

    // No templates created; every item fails because template import is gone.
    expect(prisma._imageStore.size).toBe(0);
    const job = prisma._jobs.get('job-x');
    expect(job.processed).toBe(0);
    expect(job.failed).toBe(2);
  });

  it('processImport randomizes gallery publishedAt within the previous 7 days by default', async () => {
    const { service, prisma } = makeService();
    prisma._jobs.set('job-gallery-random', { id: 'job-gallery-random' });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const before = Date.now();
    try {
      await (service as any).processImport(
        'job-gallery-random',
        ResourceType.GALLERY_POST,
        'admin-1',
        [{ title: 'Gallery Random', kind: 'IMAGE', mediaUrls: ['https://example.com/a.jpg'] }],
      );
    } finally {
      randomSpy.mockRestore();
    }
    const after = Date.now();

    const created = [...prisma._galleryStore.values()];
    expect(created.length).toBe(1);
    const post = created[0];
    expect(post.status).toBe(GalleryStatus.PUBLISHED);
    expect(post.authorId).toBe('admin-1');
    const publishedAt = post.publishedAt;
    expect(publishedAt).toBeInstanceOf(Date);
    expect(publishedAt.getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs);
    expect(publishedAt.getTime()).toBeLessThanOrEqual(after);
    expect(publishedAt.getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs * 0.5 - 1000);
    expect(publishedAt.getTime()).toBeLessThanOrEqual(after - sevenDaysMs * 0.5 + 1000);
  });

  it('gallery 导入的发布人固定为当前上传用户，忽略导入文件里的作者字段', async () => {
    const { service, prisma } = makeService();
    prisma._jobs.set('job-gallery-author', { id: 'job-gallery-author' });

    await (service as any).processImport('job-gallery-author', ResourceType.GALLERY_POST, 'admin-1', [
      {
        title: 'Author From Uploader',
        kind: 'IMAGE',
        mediaUrls: ['https://example.com/a.jpg'],
        // 导入文件里的作者信息必须被忽略
        authorId: 'file-author-999',
        authorName: 'Someone Else',
        authorSnapshot: { displayName: 'Someone Else', at: '2020-01-01T00:00:00.000Z' },
      },
    ]);

    const post = [...prisma._galleryStore.values()][0];
    expect(post.authorId).toBe('admin-1');
    expect(post.authorSnapshot).toMatchObject({ displayName: 'Admin User' });
    expect(post.authorSnapshot.displayName).not.toBe('Someone Else');
  });

  it('processBatchReview maps approve/reject/revise to the right status', async () => {
    const { service, prisma } = makeService();
    prisma._jobs.set('job-r', { id: 'job-r' });
    prisma._imageStore.set('a', { id: 'a' });
    prisma._imageStore.set('b', { id: 'b' });
    prisma._imageStore.set('c', { id: 'c' });

    await (service as any).processBatchReview(
      'job-r',
      ResourceType.IMAGE_TEMPLATE,
      ['a'],
      'approve',
    );
    await (service as any).processBatchReview(
      'job-r',
      ResourceType.IMAGE_TEMPLATE,
      ['b'],
      'reject',
      'no good',
    );
    await (service as any).processBatchReview(
      'job-r',
      ResourceType.IMAGE_TEMPLATE,
      ['c'],
      'revise',
      'fix it',
    );

    expect(prisma._imageStore.get('a')?.status).toBe(TemplateStatus.APPROVED);
    expect(prisma._imageStore.get('a')?.publishedAt).toBeInstanceOf(Date);
    expect(prisma._imageStore.get('b')?.status).toBe(TemplateStatus.REJECTED);
    expect(prisma._imageStore.get('b')?.rejectReason).toBe('no good');
    expect(prisma._imageStore.get('c')?.status).toBe(TemplateStatus.PENDING);
    expect(prisma._imageStore.get('c')?.rejectReason).toBe('fix it');
  });

  it('processBatchReview records failures for missing ids', async () => {
    const { service, prisma } = makeService();
    prisma._jobs.set('job-f', { id: 'job-f' });
    await (service as any).processBatchReview(
      'job-f',
      ResourceType.IMAGE_TEMPLATE,
      ['missing'],
      'approve',
    );
    const job = prisma._jobs.get('job-f');
    expect(job.failed).toBe(1);
    expect(job.processed).toBe(0);
    expect(job.errorLog).toBeTruthy();
  });

  it('processBatchDelete removes existing records and counts failures', async () => {
    const { service, prisma } = makeService();
    prisma._jobs.set('job-d', { id: 'job-d' });
    prisma._imageStore.set('x', { id: 'x' });

    await (service as any).processBatchDelete('job-d', ResourceType.IMAGE_TEMPLATE, [
      'x',
      'nope',
    ]);

    expect(prisma._imageStore.has('x')).toBe(false);
    const job = prisma._jobs.get('job-d');
    expect(job.processed).toBe(1);
    expect(job.failed).toBe(1);
  });

  it('listJobs paginates user jobs', async () => {
    const { service } = makeService();
    await service.createAndProcess('user-9', 'DELETE', ResourceType.IMAGE_TEMPLATE, {
      ids: [],
    });
    const result = await service.listJobs('user-9', 1, 20);
    expect(result.page).toBe(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});
