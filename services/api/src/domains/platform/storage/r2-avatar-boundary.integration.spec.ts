import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@autix/database';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { StorageCleanupService } from './storage-cleanup.service';

const databaseUrl = process.env.SELF_SERVICE_INTEGRATION_DATABASE_URL;
const enabled = process.env.R2_BOUNDARY_TEST === 'true' && databaseUrl;
const describeR2 = enabled ? describe : describe.skip;

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
}

describeR2('R2 avatar upload boundary and cleanup worker', () => {
  let prisma: PrismaClient;
  let r2: CloudflareR2Service;
  let uploadedKey: string | null = null;

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl! }),
    });
    const values: Record<string, string> = {
      'storage.r2BucketName': envValue('R2_BUCKET_NAME'),
      'storage.r2PublicUrl': envValue('DOMAIN', 'R2_PUBLIC_URL'),
      'storage.r2Endpoint': envValue('S3_API', 'R2_ENDPOINT'),
      'storage.r2AccessKeyId': envValue('Access_key_ID', 'R2_ACCESS_KEY_ID'),
      'storage.r2SecretAccessKey': envValue('Secret_Access_Key', 'R2_SECRET_ACCESS_KEY'),
    };
    r2 = new CloudflareR2Service({
      getString: async (key: string) => values[key] ?? '',
    } as never);
  });

  afterAll(async () => {
    if (uploadedKey) await r2.deleteObject(uploadedKey).catch(() => undefined);
    await prisma.storage_cleanup_tasks.deleteMany({
      where: { storageKey: { startsWith: 'integration/avatar-boundary/' } },
    });
    await prisma.$disconnect();
  });

  it('rejects a body whose length differs from the signed avatar length', async () => {
    const expected = new Uint8Array(1024).fill(0x61);
    const oversized = new Uint8Array(1025).fill(0x62);
    const reservation = await r2.createPresignedUpload({
      fileName: 'boundary.png',
      contentType: 'image/png',
      folder: 'integration/avatar-boundary',
      sizeBytes: expected.byteLength,
    });
    uploadedKey = reservation.key;

    const signedHeaders = new URL(reservation.uploadUrl).searchParams.get('X-Amz-SignedHeaders') ?? '';
    expect(signedHeaders).toContain('content-length');

    const accepted = await fetch(reservation.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: expected,
    });
    expect(accepted.status).toBeLessThan(300);

    const rejected = await fetch(reservation.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: oversized,
    });
    expect(rejected.status).toBe(403);
    expect((await r2.downloadObject(reservation.key)).byteLength).toBe(expected.byteLength);
  });

  it('claims a persisted cleanup task and removes the real R2 object', async () => {
    expect(uploadedKey).toBeTruthy();
    const task = await prisma.storage_cleanup_tasks.create({
      data: {
        storageKey: uploadedKey!,
        ownerUserId: null,
        reason: 'MANUAL',
      },
    });
    const worker = new StorageCleanupService(prisma as never, r2);

    const claimed = await worker.claimBatch(new Date(), 10);
    expect(claimed).toContain(task.id);
    const result = await worker.processBatch([task.id]);

    expect(result.completed).toBe(1);
    expect(await r2.objectExists(uploadedKey!)).toBe(false);
    uploadedKey = null;
  });
});
