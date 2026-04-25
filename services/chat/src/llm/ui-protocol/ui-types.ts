// ============================================================
// 公共类型
// ============================================================

/** 生成唯一 componentId */
export function generateComponentId(prefix: string = 'comp'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// 组件类型 — text
// ============================================================

export interface UIText {
  type: 'text';
  componentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// 组件类型 — selection
// ============================================================

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

// ============================================================
// 组件类型 — form
// ============================================================

export type FormFieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'checkbox';

export interface FormField {
  name: string;
  label: string;
  fieldType: FormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
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

// ============================================================
// 组件类型 — confirmation
// ============================================================

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

// ============================================================
// 组件类型 — card
// ============================================================

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

// ============================================================
// 组件类型 — steps
// ============================================================

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

// ============================================================
// 组件类型 — table
// ============================================================

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
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  metadata?: Record<string, unknown>;
}

// ============================================================
// 组件类型 — action_buttons
// ============================================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ActionButton {
  action: string;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  confirm?: {
    message: string;
  };
}

export interface UIActionButtons {
  type: 'action_buttons';
  componentId: string;
  layout?: 'horizontal' | 'vertical';
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
  thinking?: string;
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
// UI 状态相关类型
// ============================================================

export type UIStage = 'select_type' | 'fill_detail' | 'confirm' | 'result';

/** 组件交互状态 - 用于记录用户对 UI 组件的操作 */
export interface ComponentInteractionState {
  [componentId: string]: {
    action: string;           // 用户执行的操作(submit/cancel/custom)
    data: Record<string, any>; // 用户提交的数据
    timestamp: string;        // 操作时间
    disabled: boolean;        // 是否禁用该组件
  };
}

// ============================================================
// JSONL 流式协议类型
// ============================================================

/** Markdown 消息载荷 */
export interface MarkdownPayload {
  content: string;        // Markdown 文本
  isChunk: boolean;       // 是否为流式片段
  messageId?: string;     // 消息 ID(首次生成时提供)
}

/** UI 组件消息载荷 */
export interface UIPayload {
  messageId: string;      // 消息 ID
  components: UIResponse[];
  thinking?: string;
  interactionState?: ComponentInteractionState;  // 组件交互状态
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

/** 流式消息信封 - JSONL 格式的统一消息结构 */
export interface ArtifactCreatedPayload {
  artifactId: string;
  title: string;
}

export interface StreamMessage {
  messageType: 'markdown' | 'ui' | 'meta' | 'progress' | 'done' | 'error' | 'artifact_created' | 'log';
  timestamp: string;
  payload: MarkdownPayload | UIPayload | MetaPayload | ProgressPayload | ErrorPayload | ArtifactCreatedPayload | LogPayload | null;
}

// ============================================================
// Orchestrator 相关类型
// ============================================================

/** Orchestrator 流式事件类型 */
export type OrchestratorStreamEvent = 
  | { type: 'agent_start'; agent: string; step: number; totalSteps: number }
  | { type: 'token'; content: string; agent: string }
  | { type: 'agent_end'; agent: string; step: number }
  | { type: 'log'; level: 'info' | 'debug' | 'error'; message: string; data?: Record<string, any> }
  | { type: 'final'; result: OrchestratorResult };

/** Orchestrator 执行结果 */
export interface OrchestratorResult {
  responseType: 'markdown' | 'ui';  // 响应类型
  mode: 'fixed';                    // 固定模式
  usedAgents: string[];             // 使用的 Agent 列表
  steps: Record<string, string>;    // 每个 Agent 的执行结果
  report?: string;                  // responseType='markdown' 时使用
  thinking?: string;                // LLM 思考过程（Markdown 响应用）
  uiResponse?: AIUIResponse;        // responseType='ui' 时使用（内部包含 thinking）
  nextUIStage?: UIStage;            // 下一个 UI 阶段
}
