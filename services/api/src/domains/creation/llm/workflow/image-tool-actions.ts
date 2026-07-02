import type { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const GENERATE_IMAGE_TOOL_NAME = 'generate_image';
export const EDIT_IMAGE_TOOL_NAME = 'edit_image';

export type ImageToolAction =
  | {
    type: typeof GENERATE_IMAGE_TOOL_NAME;
    prompt: string;
    reasoning: string;
  }
  | {
    type: typeof EDIT_IMAGE_TOOL_NAME;
    instruction: string;
    reasoning: string;
  };

export interface ImageToolModelResult {
  message: unknown;
  usedNativeTools: boolean;
}

const imageActionTools = [
  tool(
    async () => 'Image generation request accepted.',
    {
      name: GENERATE_IMAGE_TOOL_NAME,
      description: 'Generate a new image when the user explicitly asks for an image, poster, cover, wallpaper, card, or visual asset.',
      schema: z.object({
        prompt: z.string().describe('The final prompt to send to the image generation model.'),
        reasoning: z.string().optional().describe('Brief reason for choosing image generation.'),
      }),
    },
  ),
  tool(
    async () => 'Image edit request accepted.',
    {
      name: EDIT_IMAGE_TOOL_NAME,
      description: 'Edit selected or uploaded images when the user explicitly asks to modify an image.',
      schema: z.object({
        instruction: z.string().describe('The final edit instruction to send to the image editing model.'),
        reasoning: z.string().optional().describe('Brief reason for choosing image editing.'),
      }),
    },
  ),
];

export async function invokeModelWithImageActionTools(
  model: BaseChatModel,
  messages: BaseLanguageModelInput,
): Promise<ImageToolModelResult> {
  if (typeof model.bindTools !== 'function') {
    return { message: await model.invoke(messages), usedNativeTools: false };
  }

  try {
    const modelWithTools = model.bindTools(imageActionTools, { tool_choice: 'auto' });
    return { message: await modelWithTools.invoke(messages), usedNativeTools: true };
  } catch {
    // 原生工具调用失败时优雅降级为不带工具的普通调用。
    // 部分自定义模型/网关不支持 function calling：收到 tools 参数后会返回无法解析的响应体，
    // 此时 LangChain 内部抛出的往往是不含 "tool"/"function" 字样的错误
    //（例如 "Cannot read properties of undefined (reading 'message')"），无法据错误信息可靠判断，
    // 因此对任何失败都回退到纯文本模式，由调用方从文本中解析 JSON 工具动作。
    // 若普通调用同样失败，则该错误（更贴近真实根因）自然向上抛出。
    return { message: await model.invoke(messages), usedNativeTools: false };
  }
}

export function parseImageToolActionFromMessage(message: unknown): ImageToolAction | null {
  for (const call of extractToolCalls(message)) {
    const action = parseImageToolActionFromObject({
      type: call.name,
      ...call.args,
    });
    if (action) return action;
  }
  return null;
}

export function parseImageToolActionFromText(text: string): ImageToolAction | null {
  const stripped = stripMarkdownFence(text);
  const candidates = [
    stripped,
    extractJsonObjectCandidate(stripped),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const action = parseImageToolActionFromObject(parsed);
      if (action) return action;
    } catch {
      // Continue to the next candidate.
    }
  }

  return null;
}

export function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((block) => {
        if (typeof block === 'string') return block;
        const record = asRecord(block);
        return typeof record?.text === 'string' ? record.text : '';
      })
      .join('')
      .trim();
    if (text) return text;
  }

  const encoded = JSON.stringify(content);
  return typeof encoded === 'string' ? encoded.trim() : '';
}

function parseImageToolActionFromObject(value: unknown): ImageToolAction | null {
  const parsed = asRecord(value);
  if (!parsed) return null;

  const type = parsed?.type;

  if (
    (type === GENERATE_IMAGE_TOOL_NAME || type === 'prompt_suggestion') &&
    typeof parsed.prompt === 'string' &&
    parsed.prompt.trim()
  ) {
    return {
      type: GENERATE_IMAGE_TOOL_NAME,
      prompt: parsed.prompt.trim(),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  }

  if (
    (type === EDIT_IMAGE_TOOL_NAME || type === 'edit_suggestion') &&
    typeof parsed.instruction === 'string' &&
    parsed.instruction.trim()
  ) {
    return {
      type: EDIT_IMAGE_TOOL_NAME,
      instruction: parsed.instruction.trim(),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  }

  return null;
}

function extractToolCalls(message: unknown): Array<{ name?: string; args?: Record<string, unknown> }> {
  const record = asRecord(message);
  if (!record) return [];

  const additionalKwargs = asRecord(record.additional_kwargs);
  const rawCalls = [
    ...asArray(record.tool_calls),
    ...asArray(record.toolCalls),
    ...asArray(additionalKwargs?.tool_calls),
  ];

  return rawCalls
    .map((call) => {
      const callRecord = asRecord(call);
      const functionRecord = asRecord(callRecord?.function);
      const name =
        typeof callRecord?.name === 'string'
          ? callRecord.name
          : typeof functionRecord?.name === 'string'
            ? functionRecord.name
            : undefined;
      const args = parseToolArgs(callRecord?.args ?? functionRecord?.arguments);
      return { name, args };
    })
    .filter((call) => call.name === GENERATE_IMAGE_TOOL_NAME || call.name === EDIT_IMAGE_TOOL_NAME);
}

function parseToolArgs(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed) ?? {};
    } catch {
      return {};
    }
  }
  return asRecord(value) ?? {};
}

function stripMarkdownFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractJsonObjectCandidate(text: string): string | null {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  return text.slice(first, last + 1).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
