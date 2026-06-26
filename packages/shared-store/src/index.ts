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
export * from './membership-recommendation';
export * from './membership-admin.actions';
export * from './membership-admin.queries';
export * from './risk-admin.actions';
export * from './risk-admin.queries';
export * from './membership-user.actions';
export * from './membership-user.queries';
export * from './system-settings.store';
export * from './admin-system.actions';
export * from './admin-system.queries';
export * from './admin-identity.actions';
export * from './admin-identity.queries';
export * from './admin-template.actions';
export * from './admin-template.queries';
export * from './model-config.store';
export * from './storage.actions';
export * from './ui-contracts';
export * from './task.store';
export * from './template.store';
export * from './marketplace.store';
export * from './marketplace.actions';
export * from './marketplace.queries';
export * from './profile-resources.actions';
export * from './profile-resources.queries';
export * from './public-growth.actions';
export * from './public-growth.queries';
export * from './public-creation.actions';
export * from './public-profile.queries';
export * from './material.store';
export * from './resource.store';
export * from './resource-panel.store';
export * from './image-generation.store';
export * from './image-workbench.actions';
export * from './video-generation.store';
export * from './video-project.store';
export * from './video-workbench.actions';
export * from './video-share.actions';
export * from './template-workspace.actions';
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
