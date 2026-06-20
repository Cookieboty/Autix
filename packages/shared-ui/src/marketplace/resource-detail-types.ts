import type { ReactNode } from 'react';
import type {
  AgentResource,
  ConversationKind,
  ImageTemplate,
  MarketplaceTypeSlug,
  McpServer,
  ResourceType,
  Skill,
  VideoTemplate,
} from '@autix/shared-store';

export type ResourceDetailItem =
  | ImageTemplate
  | VideoTemplate
  | Skill
  | McpServer
  | AgentResource;

export type ResourceDetailSessionOption = {
  id: string;
  title: string;
  kind?: ConversationKind;
};

export type ResourceDetailAction = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  onClick: () => void | Promise<void>;
};

export type ResourceDetailActivationDialog = {
  open: boolean;
  sessions: ResourceDetailSessionOption[];
  onSelect: (id: string | 'new') => void | Promise<void>;
  onClose: () => void;
  applying?: boolean;
  error?: string | null;
  resourceType?: ResourceType;
  onError?: (message: string | null) => void;
  mode?: 'simple' | 'template';
};

export type DetailVisualVariant = 'immersive' | 'panel';

export type ResourceDetailViewProps = {
  slug: MarketplaceTypeSlug;
  resource: ResourceDetailItem;
  resourceType?: ResourceType;
  variant?: DetailVisualVariant;
  actions?: ResourceDetailAction[];
  activationDialog?: ResourceDetailActivationDialog;
  desktopBlocked?: boolean;
  error?: string | null;
  usageMetric?: 'viewCount' | 'useCount';
  enableVideoPreview?: boolean;
  showTemplateDetails?: boolean;
  showResourceInfo?: boolean;
  showSourceInfo?: boolean;
  onBackToList: () => void;
};
