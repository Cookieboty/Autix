import {
  buildBaselineResolveCommands,
  classifyMigrationReadiness,
  containsDataStatement,
  type LocalMigration,
  type MigrationRecord,
} from '../scripts/check-migration-readiness';

const localMigrations: LocalMigration[] = [
  { name: '00_init', checksum: 'checksum-00', changesData: false },
  { name: '20260712000000_user_account_deletion', checksum: 'checksum-delete', changesData: false },
];

function applied(migrationName: string, checksum: string): MigrationRecord {
  return { migrationName, checksum, finishedAt: new Date('2026-07-12T00:00:00Z'), rolledBackAt: null };
}

describe('migration readiness classification', () => {
  test('recognizes fresh and db-push databases', () => {
    expect(classifyMigrationReadiness({
      hasApplicationTables: false,
      hasMigrationsTable: false,
      localMigrations,
      records: [],
    })).toEqual({ kind: 'fresh' });

    expect(classifyMigrationReadiness({
      hasApplicationTables: true,
      hasMigrationsTable: false,
      localMigrations,
      records: [],
    })).toEqual({ kind: 'baseline-required' });
  });

  test('reports pending migrations for a healthy managed database', () => {
    expect(classifyMigrationReadiness({
      hasApplicationTables: true,
      hasMigrationsTable: true,
      localMigrations,
      records: [applied('00_init', 'checksum-00')],
    })).toEqual({
      kind: 'managed',
      pending: ['20260712000000_user_account_deletion'],
    });
  });

  test('fails closed for unresolved and unknown migration records', () => {
    const result = classifyMigrationReadiness({
      hasApplicationTables: true,
      hasMigrationsTable: true,
      localMigrations,
      records: [
        { migrationName: '00_init', checksum: 'checksum-00', finishedAt: null, rolledBackAt: null },
        applied('migration_not_in_checkout', 'unknown'),
      ],
    });

    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.reasons).toEqual([
        'unresolved failed migrations: 00_init',
        'migration history missing locally: migration_not_in_checkout',
      ]);
    }
  });

  test('fails closed for unknown rolled-back migration history', () => {
    expect(classifyMigrationReadiness({
      hasApplicationTables: true,
      hasMigrationsTable: true,
      localMigrations,
      records: [{
        migrationName: 'rolled_back_but_missing',
        checksum: 'unknown',
        finishedAt: null,
        rolledBackAt: new Date('2026-07-12T00:00:00Z'),
      }],
    })).toEqual({
      kind: 'invalid',
      reasons: ['migration history missing locally: rolled_back_but_missing'],
    });
  });

  test('fails closed when applied migration SQL changed locally', () => {
    expect(classifyMigrationReadiness({
      hasApplicationTables: true,
      hasMigrationsTable: true,
      localMigrations,
      records: [applied('00_init', 'stale-checksum')],
    })).toEqual({
      kind: 'invalid',
      reasons: ['applied migration checksum mismatch: 00_init'],
    });
  });

  test('generates explicit resolve commands without applying them', () => {
    expect(buildBaselineResolveCommands(localMigrations.map((migration) => migration.name))).toEqual([
      'pnpm --filter @autix/database exec prisma migrate resolve --applied 00_init --schema prisma/schema.prisma',
      'pnpm --filter @autix/database exec prisma migrate resolve --applied 20260712000000_user_account_deletion --schema prisma/schema.prisma',
    ]);
  });

  test('detects data-changing SQL conservatively', () => {
    expect(containsDataStatement('-- UPDATE users SET status = 1;\nALTER TABLE users ADD x TEXT;')).toBe(false);
    expect(containsDataStatement("CREATE TYPE action AS ENUM ('DELETE');")).toBe(false);
    expect(containsDataStatement('ALTER TABLE users ADD x TEXT;\nUPDATE users SET x = null;')).toBe(true);
    expect(containsDataStatement('/* schema preparation */ UPDATE users SET x = null;')).toBe(true);
    expect(containsDataStatement('INSERT INTO audit_log(id) VALUES (1);')).toBe(true);
    expect(containsDataStatement('DELETE FROM stale_rows;')).toBe(true);
    expect(containsDataStatement('MERGE INTO users USING incoming ON users.id = incoming.id WHEN MATCHED THEN UPDATE SET email = incoming.email;')).toBe(true);
    expect(containsDataStatement('COPY users FROM STDIN;')).toBe(true);
    expect(containsDataStatement('WITH changed AS (UPDATE users SET x = null RETURNING id) SELECT * FROM changed;')).toBe(true);
  });
});
