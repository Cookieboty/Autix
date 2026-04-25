// ============================================================
// 后端 UI Protocol 类型同步
// ============================================================

export type UIStage = 'select_type' | 'fill_detail' | 'confirm' | 'result';

// ============================================================
// text 组件
// ============================================================

export interface UIText {
  type: 'text';
  componentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// selection 组件
// ============================================================

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

// ============================================================
// form 组件
// ============================================================

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

// ============================================================
// confirmation 组件
// ============================================================

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

// ============================================================
// card 组件
// ============================================================

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

// ============================================================
// steps 组件
// ============================================================

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

// ============================================================
// table 组件
// ============================================================

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

// ============================================================
// action_buttons 组件
// ============================================================

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

// ============================================================
// UIResponse 联合类型
// ============================================================

export type UIResponse =
  | UIText
  | UISelection
  | UIForm
  | UIConfirmation
  | UICard
  | UISteps
  | UITable
  | UIActionButtons;

// ============================================================
// AI 输出包装类型
// ============================================================

export interface AIUIResponse {
  messages: UIResponse[];
  thinking?: string | null;
}

// ============================================================
// UIAction 用户操作回传类型
// ============================================================

export interface UIAction {
  componentId: string;
  action: 'submit' | 'cancel' | 'custom';
  data: Record<string, unknown>;
  timestamp?: string;
}

// ============================================================
// 前端扩展类型
// ============================================================

/** 组件交互状态 - 用于记录用户对 UI 组件的操作 */
export interface ComponentInteractionState {
  [componentId: string]: {
    action: string;
    data: Record<string, any>;
    timestamp: string;
    disabled: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  messageType?: 'markdown' | 'ui';  // 新增:消息类型
  content?: string;  // markdown 类型时使用
  uiResponse?: AIUIResponse;  // ui 类型时使用（包含 thinking）
  thinking?: string;  // LLM 思考过程（优先级：顶层 > uiResponse.thinking）
  interactionState?: ComponentInteractionState;  // UI 组件交互状态
  uiStage?: UIStage;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    uiStage?: UIStage;
    usedAgents?: string[];
    retrievedDocuments?: any[];
  };
}

// ============================================================
// JSONL 流式协议类型
// ============================================================

/** Markdown 消息载荷 */
export interface MarkdownPayload {
  content: string;
  isChunk: boolean;
  messageId?: string;
}

/** UI 组件消息载荷 */
export interface UIPayload {
  messageId: string;
  components: UIResponse[];
  thinking?: string;
  interactionState?: ComponentInteractionState;
}

/** 元数据载荷 */
export interface MetaPayload {
  uiStage?: UIStage;
  usedAgents?: string[];
  retrievedDocuments?: Array<{
    documentId: string;
    content: string;
    score: number;
  }>;
}

/** 错误载荷 */
export interface ErrorPayload {
  error: string;
  code?: string;
}

/** 进度载荷 */
export interface ProgressPayload {
  agent: string;           // 当前执行的 Agent 名称
  agentDisplayName: string; // Agent 显示名称（中文）
  step: number;            // 当前步骤 (1-5)
  totalSteps: number;      // 总步骤数 (5)
  status: 'started' | 'completed'; // Agent 状态
}

/** 日志载荷 */
export interface LogPayload {
  level: 'info' | 'debug' | 'error'; // 日志级别
  message: string;                   // 日志消息
  data?: Record<string, any>;        // 附加数据
}

/** 产物创建载荷 */
export interface ArtifactCreatedPayload {
  artifactId: string;
  title: string;
}

/** 流式消息信封 - JSONL 格式 */
export interface StreamMessage {
  messageType: 'markdown' | 'ui' | 'meta' | 'progress' | 'done' | 'error' | 'log' | 'artifact_created';
  timestamp: string;
  payload: MarkdownPayload | UIPayload | MetaPayload | ProgressPayload | ErrorPayload | LogPayload | ArtifactCreatedPayload | null;
}

// 保留旧的 SSEEvent 用于兼容
export interface SSEEvent {
  type: 'ui-event' | 'summary' | 'text' | 'done' | 'error';
  data?: any;
  raw?: string;
}

export interface UIActionCallback {
  onAction: (action: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
}
