import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { createChatModel } from '../model.factory';
import {
  businessTools,
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
} from '../tools/business.tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

@Injectable()
export class FilesystemService {
  private model: ChatOpenAI;

  constructor() {
    this.model = createChatModel();
  }

  /**
   * File chat with tool execution loop
   * Implements complete tool execution cycle (tool-loop pattern)
   */
  async fileChat(input: string): Promise<{
    result: string;
    toolCalls: Array<{ name: string; args: any; result: any }>;
  }> {
    const modelWithTools = this.model.bindTools(businessTools);

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是一个电商客服助手，可以使用以下工具：
1. query_order: 查询订单详情
2. query_product: 查询商品详情
3. read_file: 读取文件内容（政策、FAQ 等）
4. write_file: 写入文件（工单、报告）

重要提示：
- 所有文件路径都是相对于 workspace/ 目录的
- 用户输入的路径可能包含 "workspace/" 前缀，你需要去掉这个前缀
- 例如：用户说 "workspace/policies/return-policy.md"，你应该使用 "policies/return-policy.md"
- 例如：用户说 "policies/return-policy.md"，你直接使用 "policies/return-policy.md"

请根据用户需求，合理调用工具完成任务。`,
      ],
      ['human', '{input}'],
    ]);

    // Initial invocation
    const initialMessages = await prompt.formatMessages({ input });
    let response = await modelWithTools.invoke(initialMessages);

    // Tool execution loop
    const messages = [...initialMessages, response];
    const toolCallsLog: Array<{ name: string; args: any; result: any }> = [];
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      // Check if there are tool calls
      if (!response.tool_calls || response.tool_calls.length === 0) {
        break;
      }

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        let result: any;

        try {
          // Call tool directly based on name
          if (toolCall.name === 'query_order') {
            result = await queryOrderTool.invoke(toolCall.args as { orderId: string });
          } else if (toolCall.name === 'query_product') {
            result = await queryProductTool.invoke(toolCall.args as { productId: string });
          } else if (toolCall.name === 'read_file') {
            result = await readFileTool.invoke(toolCall.args as { filePath: string });
          } else if (toolCall.name === 'write_file') {
            result = await writeFileTool.invoke(toolCall.args as { filePath: string; content: string });
          } else {
            result = { error: 'Unknown tool' };
          }

          toolCallsLog.push({
            name: toolCall.name,
            args: toolCall.args,
            result,
          });

          // Add tool message to conversation
          messages.push(
            new ToolMessage({
              content: JSON.stringify(result),
              tool_call_id: toolCall.id!,
            })
          );
        } catch (error: any) {
          messages.push(
            new ToolMessage({
              content: JSON.stringify({ error: error.message }),
              tool_call_id: toolCall.id!,
            })
          );
        }
      }

      // Continue conversation with tool results
      response = await modelWithTools.invoke(messages);
      messages.push(response);
    }

    return {
      result: response.content.toString(),
      toolCalls: toolCallsLog,
    };
  }
}
