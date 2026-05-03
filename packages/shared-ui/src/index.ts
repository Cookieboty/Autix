// 导航适配
export * from './navigation';
export { Image } from './next-compat';

// 通用 shell + Language
export * from './dialog-shell';
export * from './drawer-shell';
export * from './admin-drawer-shell';
export * from './admin-dialog-shell';
export * from './LanguageSelector';

// hooks
export * from './hooks/useTaskEvents';
export * from './hooks/useIsElectron';

// Marketplace
export * from './marketplace/ResourceCard';
export * from './marketplace/ResourceGrid';
export * from './marketplace/ResourcePanel';
export * from './marketplace/MarketplaceTopNav';
export * from './marketplace/MarketplaceSidebar';
export * from './marketplace/HotRankingList';
export * from './marketplace/EditorPicks';
export * from './marketplace/PlatformStats';
export * from './marketplace/RuntimeBadge';
export * from './marketplace/forms/PublishDrawer';

// 业务组件 — 平铺导出（命名冲突时显式 alias）
export * from './chat/ChatInput';
export * from './chat/ChatView';
export * from './chat/ActiveResourcesBar';
export * from './chat/ResourceLauncher';
export * from './chat/CollapsibleSidebarFrame';
export * from './chat/MessageBubble';
export * from './chat/ThinkingIndicator';
export * from './chat/sidebar';

export * from './arena/ArenaModelParamsDrawer';
export * from './arena/ArenaModelSelector';
export * from './arena/ArenaResponseCard';
export * from './arena/ArenaTurnGroup';
export * from './arena/ArenaView';

export * from './artifact/ArtifactEditor';
export * from './artifact/ArtifactPanel';
export * from './artifact/ArtifactToolbar';
export * from './artifact/ArtifactViewer';
export * from './artifact/OptimizeDialog';
export * from './artifact/VersionHistory';

export * from './ai-ui/AIUIRenderer';

export * from './docs/DocArticle';

export * from './library/ChunksDrawer';
export * from './library/DocumentCard';
export * from './library/LibraryView';
export * from './library/UploadZone';

export * from './models/AmuxImportDialog';

export * from './notifications/NotificationBell';
export * from './notifications/NotificationPanel';

export * from './providers/TaskSseProvider';

export * from './template/FallbackImage';
export * from './template/ImageUploader';
export * from './template/TemplateCard';
export * from './template/TemplateFormDrawer';
export * from './template/VariableEditor';

// UI primitives
export * from './ui/badge';
export * from './ui/button';
export * from './ui/card';
export * from './ui/input';
export * from './ui/textarea';

// Admin — Layout
export * from './admin/layout/header';
export * from './admin/layout/sidebar';
export * from './admin/layout/theme-toggle';

// Admin — Permission Tree（PermissionDrawer 与 admin/roles 同名，需 alias）
export * from './admin/permission-tree/detail-panel';
export * from './admin/permission-tree/menu-drawer';
export * from './admin/permission-tree/menu-node';
export { PermissionDrawer as PermissionTreePermissionDrawer } from './admin/permission-tree/permission-drawer';
export * from './admin/permission-tree/permission-node';
export * from './admin/permission-tree/system-drawer';
export * from './admin/permission-tree/system-node';
export {
  type MenuNode as MenuNodeData,
  type PermissionNode as PermissionNodeData,
  type SystemNode as SystemNodeData,
  TreeProvider,
  useTreeContext,
} from './admin/permission-tree/tree-context';
export * from './admin/permission-tree/tree-view';

// Admin — Roles
export * from './admin/roles/role-drawer';
export { PermissionDrawer as RolesPermissionDrawer } from './admin/roles/permission-drawer';

// Admin — Users
export * from './admin/users/user-drawer';
export * from './admin/users/registration-approval';
