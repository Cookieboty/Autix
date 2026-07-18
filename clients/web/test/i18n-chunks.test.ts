import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHUNKS,
  chunkLoaders,
  loadMessages,
  SUPPORTED_LANGUAGES,
  type MessageChunk,
} from '@autix/i18n';

const MSG_ROOT = join(__dirname, '../../../packages/i18n/src/messages');

function readChunkJson(chunk: MessageChunk, locale: string): Record<string, unknown> {
  const src = readFileSync(join(MSG_ROOT, chunk, `${locale}.json`), 'utf8');
  return JSON.parse(src) as Record<string, unknown>;
}

describe('i18n chunk 拆分护栏', () => {
  it('每个 chunk 都为所有 SUPPORTED_LANGUAGES 提供 JSON', () => {
    for (const chunk of CHUNKS) {
      const files = readdirSync(join(MSG_ROOT, chunk));
      for (const locale of SUPPORTED_LANGUAGES) {
        expect(files, `chunk=${chunk}`).toContain(`${locale}.json`);
      }
    }
  });

  it('同一 chunk 内各 locale 的 top-level namespace 集合一致（防止翻译漂移）', () => {
    for (const chunk of CHUNKS) {
      const base = new Set(Object.keys(readChunkJson(chunk, 'en')).sort());
      for (const locale of SUPPORTED_LANGUAGES) {
        const cur = new Set(Object.keys(readChunkJson(chunk, locale)).sort());
        expect([...cur].sort(), `chunk=${chunk} locale=${locale}`).toEqual([...base].sort());
      }
    }
  });

  it('顶层 namespace 在 chunk 之间不重复（CHUNKS 分区不变量）', () => {
    for (const locale of SUPPORTED_LANGUAGES) {
      const owner = new Map<string, MessageChunk>();
      for (const chunk of CHUNKS) {
        for (const ns of Object.keys(readChunkJson(chunk, locale))) {
          const prev = owner.get(ns);
          expect(prev, `namespace ${ns} 同时属于 chunk ${prev} 与 ${chunk}`).toBeUndefined();
          owner.set(ns, chunk);
        }
      }
    }
  });

  // 守护 `pnpm run i18n:check` 覆盖不到的那一层：checker 只读文件，而 chunkLoaders
  // 是一张手写的 8×7 动态 import 表，抄错一行（common 的 loader 指向 auth/en.json）
  // 文件系统层面完全正常，只有真正走一遍加载器才看得出来。
  it('chunkLoaders 每一项都指向对应的 chunk/locale 文件', async () => {
    for (const chunk of CHUNKS) {
      for (const locale of SUPPORTED_LANGUAGES) {
        const viaLoader = await chunkLoaders[chunk][locale]();
        const onDisk = readChunkJson(chunk, locale);
        expect(viaLoader, `chunk=${chunk} locale=${locale}`).toEqual(onDisk);
      }
    }
  });

  it('loadMessages 合并结果 == 该 locale 全部 chunk 文件的并集', async () => {
    for (const locale of SUPPORTED_LANGUAGES) {
      const expected: Record<string, unknown> = {};
      for (const chunk of CHUNKS) Object.assign(expected, readChunkJson(chunk, locale));
      await expect(loadMessages(locale)).resolves.toEqual(expected);
    }
  });
});
