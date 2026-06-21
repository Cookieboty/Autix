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

// Migrations that existed during the db-push era. Only these get baselined
// when transitioning from db push to prisma migrate. Anything after this
// cutoff is a genuine new migration and must be applied by `migrate deploy`.
//
// Migration directories are not zero-padded (`9_...`, `10_...`), so all cutoff
// checks must use the numeric prefix instead of lexical string comparison.
const BASELINE_CUTOFF = migrationNumber('3_batch_jobs');
const POINTS_LEDGER_MIGRATION = '7_points_ledger';

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
    await ensurePointsLedgerBaseline(client);
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

  const migrationDirs = readdirSync(MIGRATIONS_DIR)
    .filter((d) => !d.startsWith('.') && d !== 'migration_lock.toml')
    .sort(compareMigrationDirs);

  for (const dir of migrationDirs) {
    if (migrationNumber(dir) > BASELINE_CUTOFF) {
      console.log(`  ⏭️  skipping ${dir} (after baseline cutoff)`);
      continue;
    }

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

/**
 * Repair databases that were previously baselined with lexical migration
 * ordering. In that state, migrations `10_*` through `20_*` may be recorded as
 * applied before `7_points_ledger`, causing `19_unique_point_grant_source` to
 * fail because `point_grants` does not exist.
 */
async function ensurePointsLedgerBaseline(client: pg.Client) {
  const hasUserPoints = await tableExists(client, 'user_points');
  const hasPointGrants = await tableExists(client, 'point_grants');
  if (!hasUserPoints || hasPointGrants) return;

  const hasMigrationsTable = await tableExists(client, '_prisma_migrations');
  if (!hasMigrationsTable) return;

  const sqlPath = join(MIGRATIONS_DIR, POINTS_LEDGER_MIGRATION, 'migration.sql');
  if (!existsSync(sqlPath)) {
    throw new Error(`missing required migration SQL: ${POINTS_LEDGER_MIGRATION}`);
  }

  console.log(`🔧 [flat-migrate] applying prerequisite migration: ${POINTS_LEDGER_MIGRATION}`);
  const originalSql = readFileSync(sqlPath, 'utf-8');
  await executePointsLedgerMigration(client, originalSql);
  await markMigrationApplied(client, POINTS_LEDGER_MIGRATION, originalSql);
  console.log(`✅ [flat-migrate] prerequisite applied: ${POINTS_LEDGER_MIGRATION}`);
}

/**
 * Resolve failed migrations that block `prisma migrate deploy` (P3009).
 *
 * For each failed migration, attempt to apply the SQL and mark it as applied,
 * or mark it as rolled-back if it cannot be applied.
 */
async function resolveFailedMigrations(client: pg.Client) {
  const hasMigrationsTable = await tableExists(client, '_prisma_migrations');
  if (!hasMigrationsTable) return;

  const { rows: failed } = await client.query(
    `SELECT migration_name FROM "_prisma_migrations"
     WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
  );

  if (failed.length === 0) {
    console.log('✅ [flat-migrate] no failed migrations');
    return;
  }

  for (const { migration_name } of failed) {
    const sqlPath = join(MIGRATIONS_DIR, migration_name, 'migration.sql');
    if (!existsSync(sqlPath)) {
      // No SQL file — mark as rolled back
      await client.query(
        `UPDATE "_prisma_migrations" SET rolled_back_at = NOW() WHERE migration_name = $1`,
        [migration_name],
      );
      console.log(`↩️  [flat-migrate] rolled back (no SQL): ${migration_name}`);
      continue;
    }

    const sql = readFileSync(sqlPath, 'utf-8');
    try {
      await client.query(sql);
      await client.query(
        `UPDATE "_prisma_migrations" SET finished_at = NOW(), applied_steps_count = 1 WHERE migration_name = $1`,
        [migration_name],
      );
      console.log(`✅ [flat-migrate] re-applied: ${migration_name}`);
    } catch (err: any) {
      // If it fails because objects already exist, the migration was partially
      // applied — mark as rolled back so deploy can continue.
      await client.query(
        `UPDATE "_prisma_migrations" SET rolled_back_at = NOW() WHERE migration_name = $1`,
        [migration_name],
      );
      console.log(`↩️  [flat-migrate] rolled back (${err.message?.slice(0, 80)}): ${migration_name}`);
    }
  }
}

async function migrationRecord(client: pg.Client, migrationName: string) {
  const { rows } = await client.query(
    `SELECT id, finished_at, rolled_back_at FROM "_prisma_migrations"
     WHERE migration_name = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [migrationName],
  );
  return rows[0] as { id: string; finished_at: Date | null; rolled_back_at: Date | null } | undefined;
}

async function markMigrationApplied(client: pg.Client, migrationName: string, sql: string) {
  const checksum = createHash('sha256').update(sql).digest('hex');
  const existing = await migrationRecord(client, migrationName);

  if (existing && !existing.rolled_back_at) {
    await client.query(
      `UPDATE "_prisma_migrations"
       SET checksum = $2, finished_at = NOW(), applied_steps_count = 1
       WHERE id = $1`,
      [existing.id, checksum],
    );
    return;
  }

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

function compareMigrationDirs(a: string, b: string): number {
  const byNumber = migrationNumber(a) - migrationNumber(b);
  return byNumber === 0 ? a.localeCompare(b) : byNumber;
}

function migrationNumber(name: string): number {
  const match = name.match(/^(\d+)_/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]);
}


async function executePointsLedgerMigration(client: pg.Client, sql: string) {
  const lines = sql.split('\n');
  let current = '';

  const statements: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());

  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (err: any) {
      const code = err?.code;
      // 42710 = duplicate_object (type already exists)
      // 42P07 = duplicate_table
      // 42701 = duplicate_column
      // 42P16 = invalid_table_definition (column already exists for ADD COLUMN IF NOT EXISTS on older PG)
      if (['42710', '42P07', '42701', '42P16'].includes(code)) {
        continue;
      }
      // "already exists" or "does not exist" in ALTER TYPE ADD VALUE IF NOT EXISTS
      if (err?.message?.includes('already exists') || err?.message?.includes('does not exist')) {
        continue;
      }
      throw err;
    }
  }
}

main().catch((e) => {
  console.error('❌ [flat-migrate] failed:', e);
  process.exit(1);
});
