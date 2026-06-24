/**
 * flat-migrate.ts
 *
 * Runs BEFORE `prisma migrate deploy` in the cutover pipeline.
 *
 * 1. Auto-baseline: if the database was previously managed by `db push`
 *    (tables exist but no `_prisma_migrations` table), mark the single
 *    `00_init` migration as already applied so `prisma migrate deploy`
 *    doesn't try to replay schema that already exists.
 *
 * 2. Resolve any failed migrations so deploy can proceed.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import pg from 'pg';

const { Client } = pg;

const MIGRATIONS_DIR = resolve(__dirname, '../prisma/migrations');
const INIT_MIGRATION = '00_init';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await autoBaseline(client);
    await resolveFailedMigrations(client);
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

  const sqlPath = join(MIGRATIONS_DIR, INIT_MIGRATION, 'migration.sql');
  if (!existsSync(sqlPath)) {
    throw new Error(`missing init migration SQL: ${INIT_MIGRATION}`);
  }

  const sql = readFileSync(sqlPath, 'utf-8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  await client.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
     VALUES ($1, $2, $3, NOW(), NOW(), 1)
     ON CONFLICT (id) DO NOTHING`,
    [crypto.randomUUID(), checksum, INIT_MIGRATION],
  );

  console.log(`  ✅ baselined: ${INIT_MIGRATION}`);
  console.log('🔧 [flat-migrate] baseline complete');
}

/**
 * Resolve failed or rolled-back migrations that block `prisma migrate deploy`.
 * Handles both P3009 (failed) and P3018 (already-exists) scenarios.
 */
async function resolveFailedMigrations(client: pg.Client) {
  const hasMigrationsTable = await tableExists(client, '_prisma_migrations');
  if (!hasMigrationsTable) return;

  const { rows: problematic } = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
     WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`,
  );

  if (problematic.length === 0) {
    console.log('✅ [flat-migrate] no failed migrations');
    return;
  }

  for (const { migration_name } of problematic) {
    const sqlPath = join(MIGRATIONS_DIR, migration_name, 'migration.sql');
    if (!existsSync(sqlPath)) {
      await client.query(
        `DELETE FROM "_prisma_migrations" WHERE migration_name = $1`,
        [migration_name],
      );
      console.log(`🗑️  [flat-migrate] removed (no SQL file): ${migration_name}`);
      continue;
    }

    const sql = readFileSync(sqlPath, 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    try {
      await client.query(sql);
      await markAsApplied(client, migration_name, checksum);
      console.log(`✅ [flat-migrate] re-applied: ${migration_name}`);
    } catch (err: any) {
      const msg = err.message || '';
      if (isAlreadyExistsError(msg)) {
        await markAsApplied(client, migration_name, checksum);
        console.log(`✅ [flat-migrate] baselined (schema already exists): ${migration_name}`);
      } else {
        await client.query(
          `DELETE FROM "_prisma_migrations" WHERE migration_name = $1`,
          [migration_name],
        );
        console.log(`🗑️  [flat-migrate] removed (${msg.slice(0, 80)}): ${migration_name}`);
      }
    }
  }
}

function isAlreadyExistsError(message: string): boolean {
  return /already exists|duplicate key|relation .+ already exists/i.test(message);
}

async function markAsApplied(client: pg.Client, migrationName: string, checksum: string) {
  await client.query(`DELETE FROM "_prisma_migrations" WHERE migration_name = $1`, [migrationName]);
  await client.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, started_at, applied_steps_count)
     VALUES ($1, $2, $3, NOW(), NOW(), 1)`,
    [crypto.randomUUID(), checksum, migrationName],
  );
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
