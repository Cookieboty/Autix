// services/chat/src/conversation/ui-action.parser.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { uiActionSchema } from '../llm/ui-protocol/ui-schemas';
import type { UIAction, AIUIResponse } from '../llm/ui-protocol/ui-types';

export type UIStage = 'select_type' | 'fill_detail' | 'confirm' | 'result';

export interface UIContext {
  uiStage?: UIStage;
  lastUIResponse?: AIUIResponse;
  userAction?: UIAction;
  collectedData: Record<string, unknown>;
  analysisResult?: string;
  riskResult?: string;
}

@Injectable()
export class UIActionParser {
  /**
   * 检测并解析 UIAction,构建 UIContext
   * @param body 请求 body (可能是字符串或 UIAction 对象)
   * @param lastMessageMetadata 上一条消息的 metadata
   * @returns UIContext 或 null (如果不是 UIAction)
   */
  parse(body: unknown, lastMessageMetadata?: Record<string, unknown>): UIContext | null {
    // 检测是否是 UIAction 结构
    if (!this.isUIAction(body)) {
      return null;
    }

    // 校验 UIAction 格式
    const parseResult = uiActionSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(`Invalid UIAction format: ${parseResult.error.message}`);
    }

    const userAction = parseResult.data as UIAction;

    // 从上一条消息的 metadata 中读取 UI 状态
    const uiStage = lastMessageMetadata?.uiStage as UIStage | undefined;
    const lastUIResponse = lastMessageMetadata?.uiResponse as AIUIResponse | undefined;
    const previousCollectedData = (lastMessageMetadata?.collectedData as Record<string, unknown>) || {};
    const analysisResult = lastMessageMetadata?.analysisResult as string | undefined;
    const riskResult = lastMessageMetadata?.riskResult as string | undefined;

    // 合并收集的数据
    const collectedData = this.mergeCollectedData(previousCollectedData, userAction.data);

    return {
      uiStage,
      lastUIResponse,
      userAction,
      collectedData,
      analysisResult,
      riskResult,
    };
  }

  /**
   * 检测 body 是否是 UIAction 结构
   */
  private isUIAction(body: unknown): boolean {
    if (!body || typeof body !== 'object') {
      return false;
    }
    const obj = body as Record<string, unknown>;
    // UIAction 必须有 componentId 和 action 字段
    return typeof obj.componentId === 'string' && typeof obj.action === 'string';
  }

  /**
   * 合并用户在各阶段输入的数据
   */
  private mergeCollectedData(
    previous: Record<string, unknown>,
    newData: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...previous,
      ...newData,
    };
  }
}
