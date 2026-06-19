export * from './client';
export * from './modules/auth.api';
export * from './modules/user.api';
export * from './modules/conversation.api';
export * from './modules/video.api';
export * from './modules/image.api';
export * from './modules/marketplace.api';
export * from './modules/membership.api';
export * from './modules/order.api';
export * from './modules/materials.api';
export * from './modules/document.api';
export * from './modules/admin.api';

export {
  authFetch,
  chatApi,
  getApiBaseUrl,
  getValidAccessToken,
  normalizeApiBase,
  refreshAuthSession,
  userApi,
} from './client';

export * from './ai-ui-api';
export * from './ai-ui-types';
export * from './amux-import';
export * from './format';

export type { ApiResponse } from '@autix/domain';
export {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  CHAT_PARAM_DEFS,
  checkAdmin,
  getEffectiveParams,
  getDefaultChatParams,
  getDefaultImageParams,
  getModelCategory,
  hasChatCapability,
  hasImageCapability,
  hasPermission,
  IMAGE_N_DEF,
  IMAGE_SELECT_DEFS,
  isVideoModel,
} from '@autix/domain';
export type {
  Menu,
  ModelCategory,
  ModelParams,
  ModelParamsConfig,
  SystemInfo,
} from '@autix/domain';
