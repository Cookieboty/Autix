// ============================================================
// 公共类型
// ============================================================

export function generateComponentId(prefix: string = 'comp'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// 组件类型（保留：前端 UI 仍在用）
// ============================================================

export interface UIText {
  type: 'text';
  componentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
}

export interface UISelection {
  type: 'selection';
  componentId: string;
  question: string;
  options: SelectionOption[];
  multiSelect: boolean;
  maxSelections?: number;
  metadata?: Record<string, unknown>;
}

export type FormFieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'checkbox';

export interface FormField {
  name: string;
  label: string;
  fieldType: FormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | boolean;
  validation?: { min?: number; max?: number; pattern?: string };
}

export interface FormGroup {
  groupLabel: string;
  fields: string[];
}

export interface UIForm {
  type: 'form';
  componentId: string;
  title?: string;
  description?: string;
  fields: FormField[];
  groups?: FormGroup[];
  metadata?: Record<string, unknown>;
}

export interface UIConfirmation {
  type: 'confirmation';
  componentId: string;
  title: string;
  summary: string;
  impact?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface CardItem {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface UICard {
  type: 'card';
  componentId: string;
  title?: string;
  items: CardItem[];
  nestedCards?: UICard[];
  metadata?: Record<string, unknown>;
}

export type StepStatus = 'pending' | 'active' | 'completed';

export interface Step {
  label: string;
  status: StepStatus;
  description?: string;
}

export interface UISteps {
  type: 'steps';
  componentId: string;
  steps: Step[];
  currentStep?: number;
  metadata?: Record<string, unknown>;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface TableRowAction {
  action: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface TableRow {
  id: string;
  cells: Record<string, string | number | boolean>;
  actions?: TableRowAction[];
}

export interface UITable {
  type: 'table';
  componentId: string;
  title?: string;
  columns: TableColumn[];
  rows: TableRow[];
  pagination?: { page: number; pageSize: number; total: number; hasMore: boolean };
  metadata?: Record<string, unknown>;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ActionButton {
  action: string;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  confirm?: { message: string };
}

export interface UIActionButtons {
  type: 'action_buttons';
  componentId: string;
  layout?: 'horizontal' | 'vertical';
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
  thinking?: string;
}

export interface UIAction {
  componentId: string;
  action: 'submit' | 'cancel' | 'custom';
  data: Record<string, unknown>;
  timestamp?: string;
}

// ============================================================
// UI Stage（新 workflow 阶段，替换旧 select_type/fill_detail/confirm/result）
// ============================================================

export type UIStage =
  | 'workflow_depth_select'
  | 'workflow_target_select'
  | 'workflow_step_running'
  | 'workflow_step_confirm'
  | 'workflow_paused'
  | 'workflow_done'
  | 'normal_chat';

export interface ComponentInteractionState {
  [componentId: string]: {
    action: string;
    data: Record<string, any>;
    timestamp: string;
    disabled: boolean;
  };
}

// ============================================================
// JSONL 流式协议类型
// ============================================================

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
  retrievedDocuments?: Array<{ documentId: string; content: string; score: number }>;
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
  data?: Record<string, any>;
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

export interface PointsConsumedPayload {
  stepKey: string;
  points: number;
  balance: number;
}

export interface StepCompletedPayload {
  stepKey: string;
  proposedNextStep?: string;
  proposalReasoning?: string;
  nextOptions: ('continue' | 'stop' | 'retry' | 'jump_to')[];
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
    | 'artifact_created'
    | 'step_artifact_created'
    | 'step_completed'
    | 'step_failed'
    | 'step_validation_failed'
    | 'step_refining'
    | 'step_critic_evaluated'
    | 'run_paused'
    | 'points_consumed'
    | 'log';
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
    | ArtifactCreatedPayload
    | StepArtifactCreatedPayload
    | StepCompletedPayload
    | PointsConsumedPayload
    | LogPayload
    | null;
}
