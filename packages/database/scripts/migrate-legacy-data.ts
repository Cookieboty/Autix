/**
 * migrate-legacy-data.ts
 *
 * One-time migration: copies data from the old separate databases
 * (user_system, autix_chat) into the new unified 'autix' database.
 *
 * Safe to run multiple times — skips if data already exists.
 *
 * Usage:
 *   DATABASE_URL=postgresql://autix:pass@postgres:5432/autix pnpm exec tsx scripts/migrate-legacy-data.ts
 */

import pg from 'pg';

const { Client } = pg;

const OLD_USER_DB = 'user_system';
const OLD_CHAT_DB = 'autix_chat';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const baseUrl = url.replace(/\/[^/]+(\?.*)?$/, '');

  const targetClient = new Client({ connectionString: url });
  await targetClient.connect();

  const targetHasData = await hasExistingData(targetClient);
  if (targetHasData) {
    console.log('⏭️  [migrate-legacy] Target database already has user data, skipping migration');
    await targetClient.end();
    return;
  }

  const userDbExists = await databaseExists(targetClient, OLD_USER_DB);
  const chatDbExists = await databaseExists(targetClient, OLD_CHAT_DB);

  if (!userDbExists && !chatDbExists) {
    console.log('⏭️  [migrate-legacy] No legacy databases found, skipping');
    await targetClient.end();
    return;
  }

  console.log('🔧 [migrate-legacy] Starting data migration from legacy databases...');

  if (userDbExists) {
    console.log(`\n📦 Migrating from ${OLD_USER_DB}...`);
    const userClient = new Client({ connectionString: `${baseUrl}/${OLD_USER_DB}` });
    await userClient.connect();
    await migrateUserSystem(userClient, targetClient);
    await userClient.end();
  }

  if (chatDbExists) {
    console.log(`\n📦 Migrating from ${OLD_CHAT_DB}...`);
    const chatClient = new Client({ connectionString: `${baseUrl}/${OLD_CHAT_DB}` });
    await chatClient.connect();
    await migrateChatData(chatClient, targetClient);
    await chatClient.end();
  }

  await targetClient.end();
  console.log('\n✅ [migrate-legacy] Data migration complete!');
}

async function hasExistingData(client: pg.Client): Promise<boolean> {
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM "users"');
    return rows[0].cnt > 0;
  } catch {
    return false;
  }
}

async function databaseExists(client: pg.Client, dbName: string): Promise<boolean> {
  const { rows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName],
  );
  return rows.length > 0;
}

async function migrateUserSystem(source: pg.Client, target: pg.Client) {
  const tables = [
    'systems',
    'users',
    'roles',
    'user_roles',
    'permissions',
    'role_permissions',
    'menus',
    'role_menus',
    'user_sessions',
    'user_accounts',
    'oauth_clients',
    'oauth_authorization_codes',
    'system_registrations',
  ];

  for (const table of tables) {
    await copyTable(source, target, table);
  }
}

async function migrateChatData(source: pg.Client, target: pg.Client) {
  const { rows: tableRows } = await source.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('_prisma_migrations')
    ORDER BY tablename
  `);

  const userSystemTables = new Set([
    'systems', 'users', 'roles', 'user_roles', 'permissions',
    'role_permissions', 'menus', 'role_menus', 'user_sessions',
    'user_accounts', 'oauth_clients', 'oauth_authorization_codes',
    'system_registrations',
  ]);

  for (const row of tableRows) {
    const table = row.tablename;
    if (userSystemTables.has(table)) continue;
    await copyTable(source, target, table);
  }
}

async function copyTable(source: pg.Client, target: pg.Client, table: string) {
  try {
    const { rows: check } = await target.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if (check.length === 0) {
      console.log(`  ⚠️  Table "${table}" does not exist in target, skipping`);
      return;
    }

    const { rows: countRows } = await target.query(`SELECT COUNT(*)::int AS cnt FROM "${table}"`);
    if (countRows[0].cnt > 0) {
      console.log(`  ⏭️  "${table}" already has data (${countRows[0].cnt} rows), skipping`);
      return;
    }

    const { rows } = await source.query(`SELECT * FROM "${table}"`);
    if (rows.length === 0) {
      console.log(`  ⏭️  "${table}" is empty in source, skipping`);
      return;
    }

    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(', ');

    let inserted = 0;
    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      try {
        await target.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
        inserted++;
      } catch (e: any) {
        if (!e.message.includes('duplicate key')) {
          console.error(`  ❌ Error inserting into "${table}":`, e.message);
        }
      }
    }

    console.log(`  ✅ "${table}": migrated ${inserted}/${rows.length} rows`);
  } catch (e: any) {
    console.error(`  ❌ Failed to copy "${table}":`, e.message);
  }
}

main().catch((e) => {
  console.error('❌ [migrate-legacy] failed:', e);
  process.exit(1);
});
