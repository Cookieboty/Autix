import { ResourceType, TemplateStatus } from '../prisma/generated';
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
  let jobSeq = 0;

  const tplDelegate = (store: Map<string, TplRecord>) => ({
    create: async ({ data }: { data: any }) => {
      const id = `tpl-${store.size + 1}`;
      const rec = { id, ...data };
      store.set(id, rec);
      return rec;
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
    image_templates: tplDelegate(imageStore),
    video_templates: tplDelegate(new Map()),
  };
  return prisma;
}

const noopSse = { emit: async () => undefined };

function makeService(overrides?: { migration?: any; prisma?: any }) {
  const prisma = overrides?.prisma ?? makeMockPrisma();
  const migration =
    overrides?.migration ??
    {
      migrateMediaFields: async (data: Record<string, any>) => ({ data, errors: [] }),
    };
  const service = new BatchJobService(prisma as any, noopSse as any, migration as any);
  return { service, prisma, migration };
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

  it('processImport creates templates and counts failures', async () => {
    const failingMigration = {
      migrateMediaFields: async (data: Record<string, any>) => {
        if (data.title === 'BAD') throw new Error('migration boom');
        return { data, errors: data.title === 'WARN' ? ['cover: 404'] : [] };
      },
    };
    const { service, prisma } = makeService({ migration: failingMigration });
    prisma._jobs.set('job-x', { id: 'job-x' });

    await (service as any).processImport('job-x', ResourceType.IMAGE_TEMPLATE, 'user-1', [
      { title: 'A' },
      { title: 'WARN' },
      { title: 'BAD' },
    ]);

    const created = [...prisma._imageStore.values()];
    // A and WARN succeed (2 created), BAD fails during migration
    expect(created.length).toBe(2);
    const sample = created.find((c) => c.title === 'A');
    expect(sample?.status).toBe(TemplateStatus.PENDING);
    expect(sample?.authorId).toBe('user-1');

    const job = prisma._jobs.get('job-x');
    expect(job.processed).toBe(2);
    expect(job.failed).toBe(1);
    // both WARN (migrate warning) and BAD (failure) appear in errorLog
    expect(job.errorLog.length).toBe(2);
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
