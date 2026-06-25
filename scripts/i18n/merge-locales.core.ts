export type Lang = string;
export type Nested = Record<string, unknown>;
export type MergeReport = {
  conflicts: Array<{ lang: Lang; key: string; web: string; desktop: string }>;
  filled: Array<{ lang: Lang; key: string; source: 'zh-CN-fallback' | 'key-path' }>;
};

export function flattenLeaves(obj: unknown, prefix = ''): Record<string, string> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.entries(obj as Nested).reduce<Record<string, string>>((acc, [k, v]) => {
      Object.assign(acc, flattenLeaves(v, prefix ? `${prefix}.${k}` : k));
      return acc;
    }, {});
  }
  return { [prefix]: String(obj) };
}

export function unflatten(flat: Record<string, string>): Nested {
  const root: Nested = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = value;
      } else {
        node[part] = (node[part] as Nested) ?? {};
        node = node[part] as Nested;
      }
    });
  }
  return root;
}

export function mergeLocaleSets(input: {
  web: Record<Lang, Nested>;
  desktop: Record<Lang, Nested>;
  langs: Lang[];
  defaultLang: Lang;
}): { merged: Record<Lang, Nested>; report: MergeReport } {
  const { web, desktop, langs, defaultLang } = input;
  const report: MergeReport = { conflicts: [], filled: [] };
  const flatByLang: Record<Lang, Record<string, string>> = {};
  for (const lang of langs) {
    const w = flattenLeaves(web[lang] ?? {});
    const d = flattenLeaves(desktop[lang] ?? {});
    const out: Record<string, string> = { ...d, ...w };
    for (const key of Object.keys(w)) {
      if (key in d && d[key] !== w[key]) {
        report.conflicts.push({ lang, key, web: w[key], desktop: d[key] });
      }
    }
    flatByLang[lang] = out;
  }
  const globalKeys = new Set<string>();
  for (const lang of langs) Object.keys(flatByLang[lang]).forEach((k) => globalKeys.add(k));
  for (const lang of langs) {
    for (const key of globalKeys) {
      if (key in flatByLang[lang]) continue;
      const fallback = flatByLang[defaultLang]?.[key];
      if (fallback !== undefined) {
        flatByLang[lang][key] = fallback;
        report.filled.push({ lang, key, source: 'zh-CN-fallback' });
      } else {
        flatByLang[lang][key] = key;
        report.filled.push({ lang, key, source: 'key-path' });
      }
    }
  }
  const merged: Record<Lang, Nested> = {};
  for (const lang of langs) merged[lang] = unflatten(flatByLang[lang]);
  return { merged, report };
}
