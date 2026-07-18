import type { SupportedLanguage } from './constants.js';

export type MessagesMap = Record<string, unknown>;

/**
 * 每个 chunk 对应 messages/{chunk}/{locale}.json，**这些文件就是唯一真源**——
 * 直接编辑它们，没有生成步骤。
 *
 * 新增 chunk 的步骤：
 * 1. 建 messages/{chunk}/{locale}.json，7 个 locale 一个都不能少；
 * 2. 这里的 CHUNKS 与 chunkLoaders 添加同名 chunk。
 *
 * `pnpm run i18n:check` 会强制：磁盘上的 chunk 目录集合 == CHUNKS（多出来的目录
 * 运行时永不加载，是静默丢键陷阱）、每个 chunk 7 个 locale 齐全、跨 locale 键对齐、
 * 以及 dist 与 src 同步。
 */
export const CHUNKS = [
  'common',
  'auth',
  'landing',
  'studio',
  'membership',
  'profile',
  'admin',
  'docs',
] as const;

export type MessageChunk = (typeof CHUNKS)[number];

type ChunkLoaderMap = Record<MessageChunk, Record<SupportedLanguage, () => Promise<MessagesMap>>>;

export const chunkLoaders: ChunkLoaderMap = {
  common: {
    'zh-CN': async () => (await import('./messages/common/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/common/zh-TW.json')).default,
    en: async () => (await import('./messages/common/en.json')).default,
    fr: async () => (await import('./messages/common/fr.json')).default,
    ja: async () => (await import('./messages/common/ja.json')).default,
    ru: async () => (await import('./messages/common/ru.json')).default,
    vi: async () => (await import('./messages/common/vi.json')).default,
  },
  auth: {
    'zh-CN': async () => (await import('./messages/auth/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/auth/zh-TW.json')).default,
    en: async () => (await import('./messages/auth/en.json')).default,
    fr: async () => (await import('./messages/auth/fr.json')).default,
    ja: async () => (await import('./messages/auth/ja.json')).default,
    ru: async () => (await import('./messages/auth/ru.json')).default,
    vi: async () => (await import('./messages/auth/vi.json')).default,
  },
  landing: {
    'zh-CN': async () => (await import('./messages/landing/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/landing/zh-TW.json')).default,
    en: async () => (await import('./messages/landing/en.json')).default,
    fr: async () => (await import('./messages/landing/fr.json')).default,
    ja: async () => (await import('./messages/landing/ja.json')).default,
    ru: async () => (await import('./messages/landing/ru.json')).default,
    vi: async () => (await import('./messages/landing/vi.json')).default,
  },
  studio: {
    'zh-CN': async () => (await import('./messages/studio/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/studio/zh-TW.json')).default,
    en: async () => (await import('./messages/studio/en.json')).default,
    fr: async () => (await import('./messages/studio/fr.json')).default,
    ja: async () => (await import('./messages/studio/ja.json')).default,
    ru: async () => (await import('./messages/studio/ru.json')).default,
    vi: async () => (await import('./messages/studio/vi.json')).default,
  },
  membership: {
    'zh-CN': async () => (await import('./messages/membership/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/membership/zh-TW.json')).default,
    en: async () => (await import('./messages/membership/en.json')).default,
    fr: async () => (await import('./messages/membership/fr.json')).default,
    ja: async () => (await import('./messages/membership/ja.json')).default,
    ru: async () => (await import('./messages/membership/ru.json')).default,
    vi: async () => (await import('./messages/membership/vi.json')).default,
  },
  profile: {
    'zh-CN': async () => (await import('./messages/profile/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/profile/zh-TW.json')).default,
    en: async () => (await import('./messages/profile/en.json')).default,
    fr: async () => (await import('./messages/profile/fr.json')).default,
    ja: async () => (await import('./messages/profile/ja.json')).default,
    ru: async () => (await import('./messages/profile/ru.json')).default,
    vi: async () => (await import('./messages/profile/vi.json')).default,
  },
  admin: {
    'zh-CN': async () => (await import('./messages/admin/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/admin/zh-TW.json')).default,
    en: async () => (await import('./messages/admin/en.json')).default,
    fr: async () => (await import('./messages/admin/fr.json')).default,
    ja: async () => (await import('./messages/admin/ja.json')).default,
    ru: async () => (await import('./messages/admin/ru.json')).default,
    vi: async () => (await import('./messages/admin/vi.json')).default,
  },
  docs: {
    'zh-CN': async () => (await import('./messages/docs/zh-CN.json')).default,
    'zh-TW': async () => (await import('./messages/docs/zh-TW.json')).default,
    en: async () => (await import('./messages/docs/en.json')).default,
    fr: async () => (await import('./messages/docs/fr.json')).default,
    ja: async () => (await import('./messages/docs/ja.json')).default,
    ru: async () => (await import('./messages/docs/ru.json')).default,
    vi: async () => (await import('./messages/docs/vi.json')).default,
  },
};

/**
 * 加载指定 locale 的一组 chunk 并合并。未传 chunks 时加载全部 chunk（等价旧行为）。
 * 合并顺序按传入数组顺序；相同顶层 namespace 出现在多个 chunk 时会以后者覆盖前者。
 * 但项目约束是每个顶层 namespace 只属于一个 chunk（由 `pnpm run i18n:check` 与
 * i18n-chunks.test.ts 里"顶层 namespace 在 chunk 之间不重复"那条断言共同保证），
 * 所以不会发生真实覆盖。
 */
export async function loadMessages(
  locale: SupportedLanguage,
  chunks: readonly MessageChunk[] = CHUNKS,
): Promise<MessagesMap> {
  const parts = await Promise.all(chunks.map((chunk) => chunkLoaders[chunk][locale]()));
  return Object.assign({}, ...parts);
}

/**
 * 向后兼容：desktop 端等一次性拿全量 messages 的场景继续可用。
 * 内部实现改为 loadMessages(locale)，即加载并合并所有 chunk。
 */
export const messageLoaders: Record<SupportedLanguage, () => Promise<MessagesMap>> = {
  'zh-CN': () => loadMessages('zh-CN'),
  'zh-TW': () => loadMessages('zh-TW'),
  en: () => loadMessages('en'),
  fr: () => loadMessages('fr'),
  ja: () => loadMessages('ja'),
  ru: () => loadMessages('ru'),
  vi: () => loadMessages('vi'),
};
