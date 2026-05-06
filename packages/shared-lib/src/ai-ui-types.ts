// ============================================================
// 后端 UI Protocol 类型同步
// ============================================================

export type UIStage =
  | 'workflow_depth_select'
  | 'workflow_target_select'
  | 'workflow_step_running'
  | 'workflow_step_confirm'
  | 'workflow_paused'
  | 'workflow_done'
  | 'normal_chat';

export interface UIText {
  type: 'text';
  componentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SelectionOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface UISelection {
  type: 'selection';
  componentId: string;
  question: string;
  options: SelectionOption[];
  multiSelect: boolean;
  maxSelections?: number | null;
  metadata?: Record<string, unknown>;
}

export type FormFieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'checkbox';

export interface FormField {
  name: string;
  label: string;
  fieldType: FormFieldType;
  placeholder?: string | null;
  required?: boolean | null;
  options?: Array<{ value: string; label: string }> | null;
  defaultValue?: string | number | boolean | null;
  validation?: {
    min?: number | null;
    max?: number | null;
    pattern?: string | null;
  } | null;
}

export interface FormGroup {
  groupLabel: string;
  fields: string[];
}

export interface UIForm {
  type: 'form';
  componentId: string;
  title?: string | null;
  description?: string | null;
  fields: FormField[];
  groups?: FormGroup[] | null;
  metadata?: Record<string, unknown>;
}

export interface UIConfirmation {
  type: 'confirmation';
  componentId: string;
  title: string;
  summary: string;
  impact?: string | null;
  confirmLabel?: string | null;
  cancelLabel?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CardItem {
  label: string;
  value: string;
  highlight?: boolean | null;
}

export interface UICard {
  type: 'card';
  componentId: string;
  title?: string | null;
  items: CardItem[];
  nestedCards?: UICard[] | null;
  metadata?: Record<string, unknown>;
}

export type StepStatus = 'pending' | 'active' | 'completed';

export interface Step {
  label: string;
  status: StepStatus;
  description?: string | null;
}

export interface UISteps {
  type: 'steps';
  componentId: string;
  steps: Step[];
  currentStep?: number | null;
  metadata?: Record<string, unknown>;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean | null;
  width?: string | null;
}

export interface TableRowAction {
  action: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | null;
}

export interface TableRow {
  id: string;
  cells: Record<string, string | number | boolean>;
  actions?: TableRowAction[] | null;
}

export interface UITable {
  type: 'table';
  componentId: string;
  title?: string | null;
  columns: TableColumn[];
  rows: TableRow[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  } | null;
  metadata?: Record<string, unknown>;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ActionButton {
  action: string;
  label: string;
  variant?: ButtonVariant | null;
  disabled?: boolean | null;
  confirm?: {
    message: string;
  } | null;
}

export interface UIActionButtons {
  type: 'action_buttons';
  componentId: string;
  layout?: 'horizontal' | 'vertical' | null;
  buttons: ActionButton[];
  metadata?: Record<string, unknown>;
}

export type UIResponse =
  | UIText
  | UISelection
  | UIForm
  | UIConfirmation
  | UICard
  | UISteps
  | UITable
  | UIActionButtons;

export interface AIUIResponse {
  messages: UIResponse[];
  thinking?: string | null;
}

export interface UIAction {
  componentId: string;
  action: 'submit' | 'cancel' | 'custom';
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface ComponentInteractionState {
  [componentId: string]: {
    action: string;
    data: Record<string, unknown>;
    timestamp: string;
    disabled: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  messageType?: 'markdown' | 'ui';
  content?: string;
  uiResponse?: AIUIResponse;
  thinking?: string;
  interactionState?: ComponentInteractionState;
  uiStage?: UIStage;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    uiStage?: UIStage;
    usedAgents?: string[];
    retrievedDocuments?: unknown[];
  };
}

export interface MarkdownPayload {
  content: string;
  isChunk: boolean;
  messageId?: string;
}

export interface UIPayload {
  messageId: string;
  components: UIResponse[];
  thinking?: string;
  interactionState?: ComponentInteractionState;
}

export interface MetaPayload {
  uiStage?: UIStage;
  usedAgents?: string[];
  retrievedDocuments?: Array<{
    documentId: string;
    content: string;
    score: number;
  }>;
}

export interface ErrorPayload {
  error: string;
  code?: string;
}

export interface ProgressPayload {
  stepKey: string;
  displayName: string;
  index: number;
  total: number;
  status: 'started' | 'completed';
}

export interface LogPayload {
  level: 'info' | 'debug' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

export interface ArtifactCreatedPayload {
  artifactId: string;
  title: string;
}

export interface StepArtifactCreatedPayload {
  stepKey: string;
  artifactStepId: string;
  contentType: string;
  version: number;
}

export interface StepCompletedPayload {
  stepKey: string;
  proposedNextStep?: string;
  proposalReasoning?: string;
  nextOptions: ('continue' | 'stop' | 'retry' | 'jump_to')[];
}

export interface PointsConsumedPayload {
  stepKey: string;
  points: number;
  balance: number;
}

export interface PromptSuggestionPayload {
  prompt: string;
  model: string;
  reasoning: string;
}

export interface EditSuggestionPayload {
  instruction: string;
  sourceImages: Array<{
    url: string;
    prompt?: string;
    generationId?: string;
    index?: number;
  }>;
  model: string;
  reasoning: string;
}

export interface ImageProgressPayload {
  taskId: string;
  model: string;
  count: number;
  sourceImages?: Array<{ url: string; prompt?: string }>;
}

export interface ImageResultItem {
  url: string;
  index?: number;
  generationId?: string;
  prompt?: string;
  sourceImages?: Array<{ url: string; prompt?: string }>;
}

export interface ImageResultPayload {
  taskId: string;
  images: Array<string | ImageResultItem>;
  prompt: string;
  model: string;
  sourceImages?: Array<{ url: string; prompt?: string }>;
}

export interface StreamMessage {
  messageType:
    | 'markdown'
    | 'prompt_suggestion'
    | 'edit_suggestion'
    | 'image_generating'
    | 'image_editing'
    | 'image_result'
    | 'ui'
    | 'meta'
    | 'progress'
    | 'done'
    | 'error'
    | 'log'
    | 'artifact_created'
    | 'step_artifact_created'
    | 'step_completed'
    | 'step_failed'
    | 'step_validation_failed'
    | 'step_refining'
    | 'step_critic_evaluated'
    | 'run_paused'
    | 'points_consumed';
  timestamp: string;
  payload:
    | MarkdownPayload
    | PromptSuggestionPayload
    | EditSuggestionPayload
    | ImageProgressPayload
    | ImageResultPayload
    | UIPayload
    | MetaPayload
    | ProgressPayload
    | ErrorPayload
    | LogPayload
    | ArtifactCreatedPayload
    | StepArtifactCreatedPayload
    | StepCompletedPayload
    | PointsConsumedPayload
    | null;
}

export interface SSEEvent {
  type: 'ui-event' | 'summary' | 'text' | 'done' | 'error';
  data?: unknown;
  raw?: string;
}

export interface UIActionCallback {
  onAction: (action: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
}
