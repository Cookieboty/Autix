/**
 * flat-migrate.ts
 *
 * Runs BEFORE `prisma migrate deploy` in the cutover pipeline.
 *
 * 1. Auto-baseline: if the database was previously managed by `db push`
 *    (tables exist but no `_prisma_migrations` table), mark all known
 *    migrations as already applied so `prisma migrate deploy` doesn't
 *    fail with P3005.
 *
 * 2. (Future) Any imperative data-migration steps go here.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import pg from 'pg';

const { Client } = pg;

const MIGRATIONS_DIR = resolve(__dirname, '../prisma/migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await autoBaseline(client);
  } finally {
    await client.end();
  }
}

async function autoBaseline(client: pg.Client) {
  const hasMigrationsTable = await tableExists(client, '_prisma_migrations');
  if (hasMigrationsTable) {
    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM "_prisma_migrations"');
    if (rows[0].cnt > 0) {
      console.log('⏭️  [flat-migrate] _prisma_migrations already populated, skipping baseline');
      return;
    }
  }

  const hasUserTable = await tableExists(client, 'users');
  if (!hasUserTable) {
    console.log('⏭️  [flat-migrate] fresh database, skipping baseline (migrate deploy will handle it)');
    return;
  }

  console.log('🔧 [flat-migrate] existing db push database detected, creating baseline...');

  if (!hasMigrationsTable) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id              VARCHAR(36)  PRIMARY KEY NOT NULL,
        checksum        VARCHAR(64)  NOT NULL,
        finished_at     TIMESTAMPTZ,
        migration_name  VARCHAR(255) NOT NULL,
        logs            TEXT,
        rolled_back_at  TIMESTAMPTZ,
        started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        applied_steps_count INTEGER  NOT NULL DEFAULT 0
      )
    `);
  }

  const migrationDirs = readdirSync(MIGRATIONS_DIR)
    .filter((d) => !d.startsWith('.') && d !== 'migration_lock.toml')
    .sort();

  for (const dir of migrationDirs) {
    const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
    if (!existsSync(sqlPath)) continue;

    const sql = readFileSync(sqlPath, 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const id = crypto.randomUUID();

    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
       VALUES ($1, $2, $3, NOW(), NOW(), 1)
       ON CONFLICT (id) DO NOTHING`,
      [id, checksum, dir],
    );

    console.log(`  ✅ baselined: ${dir}`);
  }

  console.log('🔧 [flat-migrate] baseline complete');
}

async function tableExists(client: pg.Client, tableName: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return rows.length > 0;
}

main().catch((e) => {
  console.error('❌ [flat-migrate] failed:', e);
  process.exit(1);
});
