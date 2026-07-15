import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_SOCIAL_LOGIN_FLOWS,
  ALL_STEP_UP_PURPOSES,
} from '../../domain/src/auth';
import * as dist from '../dist';
import * as sourceEnums from '../src/generated/client/enums';

const schema = readFileSync(resolve(import.meta.dirname, '../prisma/schema.prisma'), 'utf8');
const supportedLocales = ['en', 'fr', 'ja', 'ru', 'vi', 'zh-CN', 'zh-TW'] as const;

function readSchemaBlock(kind: 'enum' | 'model', name: string): string[] {
  const lines = schema.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${kind} ${name} {`);
  if (start < 0) throw new Error(`Missing ${kind} ${name} in schema.prisma`);

  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].split('//', 1)[0].trim();
    if (line === '}') return body;
    if (line && !line.startsWith('///')) body.push(line);
  }
  throw new Error(`Unterminated ${kind} ${name} in schema.prisma`);
}

function readSchemaEnum(name: string): string[] {
  return readSchemaBlock('enum', name)
    .filter((line) => !line.startsWith('@@'))
    .map((line) => line.split(/\s+/, 1)[0]);
}

function readSchemaFields(name: string): string[] {
  return readSchemaBlock('model', name)
    .filter((line) => !line.startsWith('@'))
    .map((line) => line.split(/\s+/, 1)[0]);
}

describe('database generated artifact freshness', () => {
  const enumNames = [
    'UserStatus',
    'SocialLoginFlow',
    'EmailOtpPurpose',
    'PendingUploadPurpose',
    'PendingUploadStatus',
    'StorageCleanupTaskStatus',
    'StorageCleanupReason',
  ] as const;

  for (const enumName of enumNames) {
    test(`${enumName} matches source schema in generated source and dist`, () => {
      const expected = readSchemaEnum(enumName);
      expect(Object.values(sourceEnums[enumName])).toEqual(expected);
      expect(Object.values(dist[enumName])).toEqual(expected);
    });
  }

  test('self-service models and critical fields exist in generated dist', () => {
    expect(Object.values(dist.Prisma.ModelName)).toEqual(expect.arrayContaining([
      'email_otps',
      'step_up_proofs',
      'pending_uploads',
      'storage_cleanup_tasks',
      'rate_limit_counters',
    ]));
    expect(Object.values(dist.Prisma.UserScalarFieldEnum)).toEqual(expect.arrayContaining([
      'pendingEmail',
      'nickname',
      'description',
      'avatarStorageKey',
      'deletedAt',
    ]));
    expect(Object.values(dist.Prisma.SocialLoginStateScalarFieldEnum)).toEqual(expect.arrayContaining([
      'linkUserId',
      'flow',
      'purpose',
      'sessionId',
    ]));

    expect(readSchemaFields('email_otps')).toEqual(expect.arrayContaining([
      'userId', 'emailHash', 'codeHash', 'purpose', 'sessionId', 'consumedAt', 'invalidatedAt',
    ]));
    expect(readSchemaFields('pending_uploads')).toEqual(expect.arrayContaining([
      'ownerUserId', 'storageKey', 'sizeBytes', 'purpose', 'status', 'expiresAt', 'consumedAt',
    ]));
  });

  test('domain step-up and social login contracts match database enums', () => {
    const databaseStepUpPurposes = Object.values(dist.EmailOtpPurpose)
      .filter((purpose) => purpose.startsWith('STEP_UP_'))
      .sort();
    const domainStepUpPurposes = ALL_STEP_UP_PURPOSES
      .map((purpose) => `STEP_UP_${purpose.replaceAll('-', '_').toUpperCase()}`)
      .sort();

    expect(databaseStepUpPurposes).toEqual(domainStepUpPurposes);
    expect(Object.values(dist.SocialLoginFlow).sort()).toEqual([...ALL_SOCIAL_LOGIN_FLOWS].sort());
  });

  for (const locale of supportedLocales) {
    test(`i18n ${locale} source and dist messages match`, () => {
      const source = JSON.parse(readFileSync(
        resolve(import.meta.dirname, `../../i18n/src/messages/${locale}.json`),
        'utf8',
      ));
      const built = JSON.parse(readFileSync(
        resolve(import.meta.dirname, `../../i18n/dist/messages/${locale}.json`),
        'utf8',
      ));

      expect(built).toEqual(source);
    });
  }
});
