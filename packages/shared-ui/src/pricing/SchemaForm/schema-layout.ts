import type { JsonSchemaProperty, ParamsSchema } from '@autix/domain/pricing';

export interface SchemaLayoutEntry {
  name: string;
  property: JsonSchemaProperty;
}

export interface SchemaGroup {
  /** undefined = 未分组，渲染在最前。 */
  group: string | undefined;
  entries: SchemaLayoutEntry[];
}

const UNGROUPED = Symbol('ungrouped');

/**
 * 按 x-ui.group 分组、按 x-ui.order 排序。undefined 组永远排最前（对应现状的
 * "基础参数在前、advanced 在后"隐含约定）。组间顺序按组内最小 order；组内
 * order 缺省的属性按 schema.properties 的声明顺序 tie-break。
 *
 * hidden 控件也出现在输出里——过滤是否渲染是 SchemaForm 的职责，不是这里的。
 */
export function layoutProperties(schema: ParamsSchema): SchemaGroup[] {
  const buckets = new Map<string | typeof UNGROUPED, SchemaLayoutEntry[]>();

  Object.entries(schema.properties ?? {}).forEach(([name, property]) => {
    const key = property['x-ui']?.group ?? UNGROUPED;
    const bucket = buckets.get(key) ?? [];
    bucket.push({ name, property });
    buckets.set(key, bucket);
  });

  const sortEntries = (entries: SchemaLayoutEntry[]) =>
    entries
      .map((entry, declarationIndex) => ({ entry, declarationIndex }))
      .sort((a, b) => {
        const orderA = a.entry.property['x-ui']?.order;
        const orderB = b.entry.property['x-ui']?.order;
        if (orderA !== undefined && orderB !== undefined && orderA !== orderB) return orderA - orderB;
        if (orderA !== undefined && orderB === undefined) return -1;
        if (orderA === undefined && orderB !== undefined) return 1;
        return a.declarationIndex - b.declarationIndex;
      })
      .map(({ entry }) => entry);

  const minOrder = (entries: SchemaLayoutEntry[]) =>
    Math.min(...entries.map((e) => e.property['x-ui']?.order ?? Number.POSITIVE_INFINITY));

  const groups: SchemaGroup[] = [];
  const ungrouped = buckets.get(UNGROUPED);
  if (ungrouped) groups.push({ group: undefined, entries: sortEntries(ungrouped) });

  const namedGroups = Array.from(buckets.entries())
    .filter((entry): entry is [string, SchemaLayoutEntry[]] => entry[0] !== UNGROUPED)
    .sort(([, a], [, b]) => minOrder(a) - minOrder(b));

  for (const [group, entries] of namedGroups) {
    groups.push({ group, entries: sortEntries(entries) });
  }

  return groups;
}
