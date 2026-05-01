export * from './auth.store';
export * from './language.store';
export * from './chat.store';
export * from './arena.store';
export * from './ai-ui.store';
export * from './artifact.store';
export * from './document.store';
export * from './task.store';
export * from './template.store';
export * from './ui.store';

import { useAuthStore } from './auth.store';
import { useLanguageStore } from './language.store';

/**
 * 在应用启动时调用 — 从 AuthAdapter 异步读取持久化的用户身份和语言偏好。
 *
 * 调用前提：必须先调用 @autix/shared-lib 的 registerPlatform()。
 */
export async function hydrateStores(): Promise<void> {
  await Promise.all([useAuthStore.getState().hydrate(), useLanguageStore.getState().hydrate()]);
}
