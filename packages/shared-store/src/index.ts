export * from './auth.store';
export * from './amux-import.actions';
export * from './language.store';
export * from './chat.store';
export * from './conversation.actions';
export * from './arena.store';
export * from './ai-ui.store';
export * from './ai-ui.actions';
export * from './artifact.store';
export * from './document.store';
export * from './membership.store';
export * from './system-settings.store';
export * from './admin-identity.actions';
export * from './model-config.store';
export * from './storage.actions';
export * from './ui-contracts';
export * from './task.store';
export * from './template.store';
export * from './marketplace.store';
export * from './marketplace.actions';
export * from './material.store';
export * from './resource.store';
export * from './resource-panel.store';
export * from './image-generation.store';
export * from './video-generation.store';
export * from './video-project.store';
export * from './video-workbench.actions';
export * from './ui.store';

import { useAuthStore } from './auth.store';
import { useLanguageStore } from './language.store';
import { useArenaStore } from './arena.store';

/**
 * 在应用启动时调用 — 从 AuthAdapter 异步读取持久化的用户身份和语言偏好。
 *
 * 调用前提：必须先调用 @autix/platform 的 registerPlatform()。
 */
export async function hydrateStores(): Promise<void> {
  await Promise.all([
    useAuthStore.getState().hydrate(),
    useLanguageStore.getState().hydrate(),
    useArenaStore.getState().hydrateModelParams(),
  ]);
}
