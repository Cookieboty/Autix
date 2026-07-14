const SEGMENT_RE = /^([^[\]]+)((\[\d*\])*)$/;

/**
 * 把 value 写进 target 的 path 位置，按需创建中间对象/数组。
 * 路径语法：`a.b` / `a[0].b` / `a.b[]`（`[]` = 追加到数组末尾）。
 * 引擎的全部写入都经过这里——preset 的 BindingSpec.path 是唯一的字段落点来源。
 */
export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: any = target;

  segments.forEach((segment, i) => {
    const match = SEGMENT_RE.exec(segment);
    if (!match) throw new Error(`Invalid binding path segment: "${segment}" in "${path}"`);
    const key = match[1];
    const indices = (match[2].match(/\[\d*\]/g) ?? []).map((s) => s.slice(1, -1));
    const isLast = i === segments.length - 1;

    if (indices.length === 0) {
      if (isLast) { cursor[key] = value; return; }
      cursor[key] ??= {};
      cursor = cursor[key];
      return;
    }

    cursor[key] ??= [];
    let arr = cursor[key];
    indices.forEach((raw, j) => {
      const lastIndex = j === indices.length - 1;
      const idx = raw === '' ? arr.length : Number(raw);
      if (lastIndex && isLast) { arr[idx] = value; return; }
      arr[idx] ??= lastIndex ? {} : [];
      cursor = arr[idx];
      if (!lastIndex) arr = cursor;
    });
  });
}
