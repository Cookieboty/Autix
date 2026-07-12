import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const PACKAGE_ROOT = resolve(import.meta.dir, '..');
const MIGRATIONS_DIR = resolve(PACKAGE_ROOT, 'prisma/migrations');

export interface MigrationRecord {
  migrationName: string;
  checksum: string;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
}

export interface LocalMigration {
  name: string;
  checksum: string;
  changesData: boolean;
}

export type MigrationReadiness =
  | { kind: 'fresh' }
  | { kind: 'baseline-required' }
  | { kind: 'managed'; pending: string[] }
  | { kind: 'invalid'; reasons: string[] };

export function classifyMigrationReadiness(input: {
  hasApplicationTables: boolean;
  hasMigrationsTable: boolean;
  localMigrations: LocalMigration[];
  records: MigrationRecord[];
}): MigrationReadiness {
  const { hasApplicationTables, hasMigrationsTable, localMigrations, records } = input;

  if (!hasApplicationTables && records.length === 0) {
    return { kind: 'fresh' };
  }

  if (hasApplicationTables && (!hasMigrationsTable || records.length === 0)) {
    return { kind: 'baseline-required' };
  }

  const reasons: string[] = [];
  if (!hasApplicationTables && records.length > 0) {
    reasons.push('migration history exists but application tables are missing');
  }

  const unresolved = records
    .filter((record) => record.finishedAt === null && record.rolledBackAt === null)
    .map((record) => record.migrationName);
  if (unresolved.length > 0) {
    reasons.push(`unresolved failed migrations: ${unresolved.join(', ')}`);
  }

  const localByName = new Map(localMigrations.map((migration) => [migration.name, migration]));
  const unknownHistory = records
    .map((record) => record.migrationName)
    .filter((name) => !localByName.has(name));
  if (unknownHistory.length > 0) {
    reasons.push(`migration history missing locally: ${unknownHistory.join(', ')}`);
  }

  const checksumMismatches = records
    .filter((record) => record.finishedAt !== null && record.rolledBackAt === null)
    .filter((record) => {
      const local = localByName.get(record.migrationName);
      return local !== undefined && local.checksum !== record.checksum;
    })
    .map((record) => record.migrationName);
  if (checksumMismatches.length > 0) {
    reasons.push(`applied migration checksum mismatch: ${checksumMismatches.join(', ')}`);
  }

  if (reasons.length > 0) {
    return { kind: 'invalid', reasons };
  }

  const applied = new Set(
    records
      .filter((record) => record.finishedAt !== null && record.rolledBackAt === null)
      .map((record) => record.migrationName),
  );
  return {
    kind: 'managed',
    pending: localMigrations.map((migration) => migration.name).filter((name) => !applied.has(name)),
  };
}

export function buildBaselineResolveCommands(localMigrations: string[]): string[] {
  return localMigrations.map(
    (name) => `bun --cwd packages/database --bun prisma migrate resolve --applied ${name} --schema prisma/schema.prisma`,
  );
}

function listLocalMigrations(): LocalMigration[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sqlPath = resolve(MIGRATIONS_DIR, entry.name, 'migration.sql');
      if (!existsSync(sqlPath)) throw new Error(`missing migration SQL: ${entry.name}`);
      const sql = readFileSync(sqlPath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      return { name: entry.name, checksum, changesData: containsDataStatement(sql) };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function containsDataStatement(sql: string): boolean {
  const executableSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, ' ')
    .replace(/"(?:""|[^"])*"/g, ' ');
  return /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|COPY)\b/i.test(executableSql);
}

async function tableExists(client: pg.Client, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    [tableName],
  );
  return result.rows[0]?.present === true;
}

async function loadMigrationRecords(client: pg.Client): Promise<MigrationRecord[]> {
  const result = await client.query<{
    migration_name: string;
    checksum: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>(
    `SELECT migration_name, checksum, finished_at, rolled_back_at
     FROM "_prisma_migrations"
     ORDER BY started_at ASC`,
  );
  return result.rows.map((row) => ({
    migrationName: row.migration_name,
    checksum: row.checksum,
    finishedAt: row.finished_at,
    rolledBackAt: row.rolled_back_at,
  }));
}

async function applicationTablesExist(client: pg.Client): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name <> '_prisma_migrations'
     ) AS present`,
  );
  return result.rows[0]?.present === true;
}

async function verifyDataMigrationPostconditions(
  client: pg.Client,
  migrations: LocalMigration[],
): Promise<string[]> {
  const failures: string[] = [];

  for (const migration of migrations.filter((item) => item.changesData)) {
    if (migration.name === '20260626100000_user_email_verified') {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE (email LIKE '%@users.noreply.local' OR email LIKE '%@no-email.oauth.local')
           AND "emailVerified" IS DISTINCT FROM false`,
      );
      if ((result.rows[0]?.count ?? 0) > 0) {
        failures.push(`${migration.name}: placeholder-email users are still marked verified`);
      }
      continue;
    }

    if (migration.name === '20260712120000_user_self_service_security') {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM email_otps WHERE "sessionId" IS NULL`,
      );
      if ((result.rows[0]?.count ?? 0) > 0) {
        failures.push(`${migration.name}: legacy OTP rows still have a null sessionId`);
      }
      continue;
    }

    failures.push(`${migration.name}: data-changing migration has no baseline verifier`);
  }

  return failures;
}

function verifyDatabaseMatchesSchema(): boolean {
  const result = Bun.spawnSync({
    cmd: [
      process.execPath,
      '--bun',
      'prisma',
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    cwd: PACKAGE_ROOT,
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if (result.exitCode === 0) return true;
  if (result.exitCode === 2) return false;
  throw new Error(`prisma migrate diff failed with exit code ${result.exitCode}`);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const localMigrations = listLocalMigrations();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const hasMigrationsTable = await tableExists(client, '_prisma_migrations');
    const hasApplicationTables = await applicationTablesExist(client);
    const records = hasMigrationsTable ? await loadMigrationRecords(client) : [];
    const readiness = classifyMigrationReadiness({
      hasApplicationTables,
      hasMigrationsTable,
      localMigrations,
      records,
    });

    if (readiness.kind === 'fresh') {
      console.log('Migration readiness: fresh database.');
      console.log('Run `bun --cwd packages/database --bun prisma migrate deploy --schema prisma/schema.prisma`.');
      return;
    }

    if (readiness.kind === 'managed') {
      if (readiness.pending.length === 0) {
        console.log('Migration readiness: migration history is complete.');
      } else {
        console.log(`Migration readiness: ${readiness.pending.length} pending migration(s).`);
        for (const migration of readiness.pending) console.log(`  - ${migration}`);
        console.log('Run `bun --cwd packages/database --bun prisma migrate deploy --schema prisma/schema.prisma`.');
      }
      return;
    }

    if (readiness.kind === 'invalid') {
      for (const reason of readiness.reasons) console.error(`Migration readiness failed: ${reason}`);
      process.exitCode = 1;
      return;
    }

    console.log('Migration readiness: existing db-push database detected.');
    console.log('Verifying that the live database exactly matches prisma/schema.prisma...');
    if (!verifyDatabaseMatchesSchema()) {
      console.error('Baseline refused: live schema drift exists. Review the diff before resolving migrations.');
      process.exitCode = 1;
      return;
    }

    const dataMigrationFailures = await verifyDataMigrationPostconditions(client, localMigrations);
    if (dataMigrationFailures.length > 0) {
      for (const failure of dataMigrationFailures) {
        console.error(`Baseline refused: ${failure}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('Live schema and data migration postconditions match.');
    console.log('Review and execute these commands in order to establish history:');
    for (const command of buildBaselineResolveCommands(localMigrations.map((migration) => migration.name))) {
      console.log(command);
    }
    console.log('Then run `bun --cwd packages/database --bun prisma migrate deploy --schema prisma/schema.prisma` and rerun this check.');
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Migration readiness check failed:', error);
    process.exitCode = 1;
  });
}
