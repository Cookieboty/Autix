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
