// services/chat/src/llm/ui-protocol/ui-schemas.ts
//
// 注意：OpenAI Structured Outputs 不支持以下 Zod 特性：
// - .optional() - 必须用 .nullable() 代替
// - z.record(z.unknown()) - 产生不合法的 additionalProperties
// 因此 metadata 字段被移除，需要时可在应用层处理

import { z } from 'zod';
import type {
  UIResponse,
  UIText,
  UISelection,
  UIForm,
  UIConfirmation,
  UICard,
  UISteps,
  UITable,
  UIActionButtons,
  AIUIResponse,
  UIAction,
  SelectionOption,
  FormField,
  FormGroup,
  CardItem,
  Step,
  TableColumn,
  TableRow,
  TableRowAction,
  ActionButton,
} from './ui-types';

// ============================================================
// text Schema
// ============================================================

export const selectionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().nullable(),
});

export const textSchema = z.object({
  type: z.literal('text'),
  componentId: z.string(),
  content: z.string(),
});

// ============================================================
// selection Schema
// ============================================================

export const selectionSchema = z.object({
  type: z.literal('selection'),
  componentId: z.string(),
  question: z.string(),
  options: z.array(selectionOptionSchema),
  multiSelect: z.boolean(),
  maxSelections: z.number().nullable(),
});

// ============================================================
// form Schema
// ============================================================

const formFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  fieldType: z.enum(['input', 'select', 'textarea', 'date', 'number', 'checkbox']),
  placeholder: z.string().nullable(),
  required: z.boolean().nullable(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).nullable(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  validation: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    pattern: z.string().nullable(),
  }).nullable(),
});

const formGroupSchema = z.object({
  groupLabel: z.string(),
  fields: z.array(z.string()),
});

export const formSchema = z.object({
  type: z.literal('form'),
  componentId: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  fields: z.array(formFieldSchema),
  groups: z.array(formGroupSchema).nullable(),
});

// ============================================================
// confirmation Schema
// ============================================================

export const confirmationSchema = z.object({
  type: z.literal('confirmation'),
  componentId: z.string(),
  title: z.string(),
  summary: z.string(),
  impact: z.string().nullable(),
  confirmLabel: z.string().nullable(),
  cancelLabel: z.string().nullable(),
});

// ============================================================
// card Schema
// ============================================================

const cardItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  highlight: z.boolean().nullable(),
});

export const cardSchema = z.object({
  type: z.literal('card'),
  componentId: z.string(),
  title: z.string().nullable(),
  items: z.array(cardItemSchema),
});

// ============================================================
// steps Schema
// ============================================================

const stepSchema = z.object({
  label: z.string(),
  status: z.enum(['pending', 'active', 'completed']),
  description: z.string().nullable(),
});

export const stepsSchema = z.object({
  type: z.literal('steps'),
  componentId: z.string(),
  steps: z.array(stepSchema),
  currentStep: z.number().nullable(),
});

// ============================================================
// table Schema
// ============================================================

const tableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  sortable: z.boolean().nullable(),
  width: z.string().nullable(),
});

const tableRowActionSchema = z.object({
  action: z.string(),
  label: z.string(),
  variant: z.enum(['primary', 'secondary', 'danger']).nullable(),
});

const tableRowSchema = z.object({
  id: z.string(),
  // cells 用 string Record 代替 union，避免 OpenAI JSON Schema 验证问题
  cells: z.record(z.string()),
  actions: z.array(tableRowActionSchema).nullable(),
});

export const tableSchema = z.object({
  type: z.literal('table'),
  componentId: z.string(),
  title: z.string().nullable(),
  columns: z.array(tableColumnSchema),
  rows: z.array(tableRowSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  }).nullable(),
});

// ============================================================
// action_buttons Schema
// ============================================================

const actionButtonSchema = z.object({
  action: z.string(),
  label: z.string(),
  variant: z.enum(['primary', 'secondary', 'danger', 'ghost']).nullable(),
  disabled: z.boolean().nullable(),
  confirm: z.object({ message: z.string() }).nullable(),
});

export const actionButtonsSchema = z.object({
  type: z.literal('action_buttons'),
  componentId: z.string(),
  layout: z.enum(['horizontal', 'vertical']).nullable(),
  buttons: z.array(actionButtonSchema),
});

// ============================================================
// UIResponse discriminated union
//
// 注意：OpenAI Structured Outputs 不支持 z.record()（additionalProperties）
// 因此 table 组件暂时移除，需要时可单独处理
// ============================================================

export const uiResponseSchema = z.discriminatedUnion('type', [
  textSchema,
  selectionSchema,
  formSchema,
  confirmationSchema,
  cardSchema,
  stepsSchema,
  actionButtonsSchema,
]);

// ============================================================
// AIUIResponse Schema
// ============================================================

export const aiUIResponseSchema = z.object({
  messages: z.array(uiResponseSchema),
  thinking: z.string().nullable(),
});

// ============================================================
// UIAction Schema (用于解析用户回传数据，非 OpenAI 输出)
// ============================================================

export const uiActionSchema = z.object({
  componentId: z.string(),
  action: z.enum(['submit', 'cancel', 'custom']),
  data: z.record(z.unknown()),
  timestamp: z.string().nullable().optional(),
});

// ============================================================
// JSONL 流式协议 Schemas (用于验证，非 OpenAI 输出)
// ============================================================

/** 组件交互状态 Schema */
export const componentInteractionStateSchema = z.record(
  z.object({
    action: z.string(),
    data: z.record(z.any()),
    timestamp: z.string(),
    disabled: z.boolean(),
  })
);

/** Markdown 消息载荷 Schema */
export const markdownPayloadSchema = z.object({
  content: z.string(),
  isChunk: z.boolean(),
  messageId: z.string().optional(),
});

/** UI 组件消息载荷 Schema */
export const uiPayloadSchema = z.object({
  messageId: z.string(),
  components: z.array(uiResponseSchema),
  thinking: z.string().optional(),
  interactionState: componentInteractionStateSchema.optional(),
});

/** 元数据载荷 Schema */
export const metaPayloadSchema = z.object({
  uiStage: z.enum(['select_type', 'fill_detail', 'confirm', 'result']).optional(),
  usedAgents: z.array(z.string()).optional(),
  retrievedDocuments: z.array(
    z.object({
      documentId: z.string(),
      content: z.string(),
      score: z.number(),
    })
  ).optional(),
});

/** 错误载荷 Schema */
export const errorPayloadSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

/** 流式消息 Schema */
export const streamMessageSchema = z.object({
  messageType: z.enum(['markdown', 'ui', 'meta', 'done', 'error']),
  timestamp: z.string(),
  payload: z.union([
    markdownPayloadSchema,
    uiPayloadSchema,
    metaPayloadSchema,
    errorPayloadSchema,
    z.null(),
  ]),
});

/** Orchestrator 执行结果 Schema */
export const orchestratorResultSchema = z.object({
  responseType: z.enum(['markdown', 'ui']),
  mode: z.literal('fixed'),
  usedAgents: z.array(z.string()),
  steps: z.record(z.string()),
  report: z.string().optional(),
  thinking: z.string().optional(),
  uiResponse: aiUIResponseSchema.optional(),
  nextUIStage: z.enum(['select_type', 'fill_detail', 'confirm', 'result']).optional(),
});
