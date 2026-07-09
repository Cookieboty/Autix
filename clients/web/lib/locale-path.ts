import { routing } from '@/i18n/routing';

const LOCALES: readonly string[] = routing.locales;

/**
 * 剥离路径首段的 locale 前缀（如果存在），返回裸逻辑路径。
 *
 * next-intl 的 useRouter（@/i18n/navigation）要求传入裸路径，自行加前缀；
 * 传入已带前缀的路径会导致双重前缀（如 /ja/ja/x）。当一个路径的来源不确定
 * 是否已带前缀时（见 OAUTH_RETURN_TO_KEY 的两个生产者），先经过本函数归一化。
 */
export function stripLocalePrefix(path: string): string {
  const match = path.match(/^\/([^/]+)(\/.*|)$/);
  if (!match) return path;
  const [, first, rest] = match;
  if (!LOCALES.includes(first)) return path;
  return rest === '' ? '/' : rest;
}
