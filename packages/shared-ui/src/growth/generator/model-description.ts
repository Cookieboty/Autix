import type { ModelConfigItem } from '@autix/shared-store';

/**
 * 模型简介的取文案规则。
 *
 * `model_configs.description` 是运营在管理端填的 i18n map（`{ "en": "...", "zh-CN": "..." }`），
 * 不是普通字符串——不能直接往界面上扔。回退链：
 *
 *   当前语种 → 语种主标签（`zh-TW` 找不到时退 `zh`，`zh-CN` 同理）→ `en` → 任意一条非空
 *
 * 全空（运营没填，库里就是 `{}`）返回 undefined，由调用方决定不渲染那一行 ——
 * **不回退到模型 id**：那正是这次要从界面上拿掉的东西。
 */
export function resolveModelDescription(
  model: Pick<ModelConfigItem, 'description'>,
  locale: string,
): string | undefined {
  const map = model.description;
  if (!map || typeof map !== 'object') return undefined;

  const pick = (key: string) => {
    const value = map[key];
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  };

  const base = locale.split('-')[0] ?? locale;
  const exact = pick(locale) ?? pick(base);
  if (exact) return exact;

  // 语种前缀匹配：locale=zh-TW 时也认库里的 zh-CN（有总比没有强）
  const prefixed = Object.keys(map).find((key) => key.split('-')[0] === base);
  if (prefixed) {
    const value = pick(prefixed);
    if (value) return value;
  }

  return pick('en') ?? Object.keys(map).map(pick).find(Boolean);
}
