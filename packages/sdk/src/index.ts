export * from './client';
export * from './client-core';
export * from './modules/auth.api';
export * from './modules/user.api';
export * from './modules/conversation.api';
export * from './modules/video.api';
export * from './modules/image.api';
export * from './modules/marketplace.api';
export * from './modules/metrics.api';
export * from './modules/membership.api';
export * from './modules/order.api';
export * from './modules/materials.api';
export * from './modules/canvas.api';
export * from './modules/document.api';
export * from './modules/admin.api';
export * from './modules/public-growth.api';
export * from './modules/security.api';

export { chatApi, userApi } from './client';
export {
  authFetch,
  authFetchEventSource,
  getApiBaseUrl,
  getApiUrl,
  getValidAccessToken,
  normalizeApiBase,
  refreshAuthSession,
  uploadToPresignedUrl,
} from './client-core';

export * from './ai-ui-api';
export * from './ai-ui-types';
export * from './format';
export * from './insufficient-points-reporter';

export type { ApiResponse } from '@autix/domain';
export {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  checkAdmin,
  getModelCategory,
  hasChatCapability,
  hasImageCapability,
  hasPermission,
  isVideoModel,
} from '@autix/domain';
export type {
  Menu,
  ModelCategory,
  SystemInfo,
} from '@autix/domain';
