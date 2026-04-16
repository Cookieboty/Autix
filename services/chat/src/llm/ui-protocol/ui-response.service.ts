// services/chat/src/llm/ui-protocol/ui-response.service.ts

import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { createChatModel } from '../model.factory';
import { loadLangChainConfig, getApiKeys } from '../../config/load-langchain-config';
import { aiUIResponseSchema } from './ui-schemas';
import type { AIUIResponse } from './ui-types';

const SYSTEM_PROMPT = `你是一个智能助手，根据用户输入判断返回合适的 UI 组件。

## 组件选择规则

| 用户意图 | 应返回组件 |
|----------|------------|
| 用户说"我要提一个新需求" | selection（单选：需求类型）|
| 用户说"查看需求详情" | card（需求信息卡片）|
| 用户说"开始分析" | confirmation（确认）+ steps（分析进度）|
| 需要用户输入具体信息 | form（动态表单）|
| 展示列表/表格数据 | table（数据表格）|
| 提供快捷操作入口 | action_buttons（操作按钮组）|
| 普通对话/解释说明 | text（纯文本/Markdown）|

## 返回格式要求

- 每次调用必须返回 messages 数组（至少一个组件）
- componentId 在同一 session 内必须唯一
- 选择合适的 type 值，type 是 discriminated union 的依据
- 组件内容应简洁、专业，符合需求分析场景
- messages 数组中可以有多个组件（如 confirmation + steps）

## 组件组合规则

- confirmation 通常与 steps 组合返回（确认 + 进度）
- form 可与 action_buttons 组合（表单 + 提交按钮）
- table 可与 action_buttons 组合（表格 + 批量操作）
- 多个组件时按逻辑顺序排列`;

@Injectable()
export class UIResponseService {
  private readonly model: BaseChatModel;

  constructor() {
    const config = loadLangChainConfig();
    const keys = getApiKeys();
    this.model = createChatModel({
      modelConfigId: 'ui-protocol',
      modelName: config.llm.model,
      temperature: config.llm.temperature,
      maxTokens: config.llm.maxTokens,
      baseUrl: keys.openaiBaseUrl,
      apiKey: keys.openaiApiKey,
    });
  }

  /**
   * 根据用户输入和上下文，生成包含 UI 组件的结构化回复
   */
  async generateUIResponse(
    input: string,
    history: BaseMessage[] = [],
    context?: Record<string, unknown>,
  ): Promise<AIUIResponse> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      new MessagesPlaceholder({ variableName: 'history', optional: true }),
      ['human', '{input}'],
    ]);

    // 1. 先格式化 prompt 得到 messages (修复: 使用传入的 history 而非空数组)
    const formatted = await prompt.formatMessages({
      input,
      history: history || [],
    });

    // 2. 将 messages 直接传给 model.withStructuredOutput
    const structuredOutput = this.model.withStructuredOutput(aiUIResponseSchema);
    const result = await structuredOutput.invoke(formatted) as AIUIResponse;

    return result;
  }

  /**
   * Stage 1: 生成需求类型选择 UI
   */
  async generateSelectionForRequirementType(): Promise<AIUIResponse> {
    const input = '请选择您的需求类型';
    return this.generateUIResponse(input, []);
  }

  /**
   * Stage 2: 生成需求详情填写表单
   */
  async generateFormForRequirementDetail(requirementType: string): Promise<AIUIResponse> {
    const input = `用户选择了需求类型: ${requirementType}，请生成需求详情填写表单`;
    return this.generateUIResponse(input, []);
  }

  /**
   * Stage 3: 生成确认对话框和分析结果卡片
   */
  async generateConfirmation(
    analysisResult: string,
    riskResult: string,
  ): Promise<AIUIResponse> {
    const input = `分析完成。分析结果:\n${analysisResult}\n\n风险评估:\n${riskResult}\n\n请生成确认对话框和结果卡片`;
    return this.generateUIResponse(input, []);
  }

  /**
   * Stage 4: 生成结果步骤和操作按钮
   */
  async generateResultSteps(summaryReport: string): Promise<AIUIResponse> {
    const input = `最终报告:\n${summaryReport}\n\n请生成步骤进度条和操作按钮`;
    return this.generateUIResponse(input, []);
  }
}
