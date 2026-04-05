import { Injectable } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import { createChatModel } from "./model.factory";
import { buildSummaryPrompt } from "./summary.prompt-builder";
import { buildRequirementPrompt } from "./requirement.prompt-builder";
import { summaryChain } from "./summary.chain";
import { requirementChain } from "./requirement.chain";
import { SummaryService } from "./summary.service";
import { RequirementService } from "./requirement.service";
import { SummaryResult, RequirementResult } from "@repo/contracts";
import { basicTools, checkConstraintValidityTool, lookupEntityDefinitionTool } from "./tools/basic.tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { REQUIREMENT_SYSTEM_PROMPT, REQUIREMENT_USER_TEMPLATE } from "./prompts/requirement.prompt";
import { ToolCall } from "langchain";

@Injectable()
export class LlmService {
  private model: ChatOpenAI;
  private summaryService: SummaryService;
  private requirementService: RequirementService;

  constructor() {
    this.model = createChatModel();
    this.summaryService = new SummaryService();
    this.requirementService = new RequirementService();
  }

  async invokeDemo(input: string): Promise<string> {
    const systemMessage = new SystemMessage("需求结构化抽取助手");
    const humanMessage = new HumanMessage(input);
    const messages: BaseMessage[] = [systemMessage, humanMessage];
    const response = await this.model.invoke(messages);
    return response.content.toString();
  }

  async streamDemo(input: string) {
    const systemMessage = new SystemMessage("需求结构化抽取助手");
    const humanMessage = new HumanMessage(input);
    const messages: BaseMessage[] = [systemMessage, humanMessage];

    return this.model.stream(messages);
  }

  async batchDemo(inputs: string[]): Promise<string[]> {
    const systemMessage = new SystemMessage("需求结构化抽取助手");

    const results: string[] = [];
    for (const input of inputs) {
      const humanMessage = new HumanMessage(input);
      const messages: BaseMessage[] = [systemMessage, humanMessage];
      const response = await this.model.invoke(messages);
      results.push(response.content.toString());
    }

    return results;
  }

  /**
   * Render prompt template without calling the model
   */
  async renderPromptPreview(input: string): Promise<{ rendered: string }> {
    const prompt = buildSummaryPrompt();
    const rendered = await prompt.invoke({ input });
    return { rendered: rendered.toString() };
  }

  /**
   * Render prompt template and call the model
   */
  async renderPromptToModel(input: string): Promise<{ result: string }> {
    const prompt = buildSummaryPrompt();
    const messages = await prompt.formatMessages({ input });
    const response = await this.model.invoke(messages);
    return { result: response.content.toString() };
  }

  /**
   * Chain invoke - uses pipe() chain
   */
  async chainInvoke(input: string): Promise<{ result: string }> {
    const result = await requirementChain.invoke({ input });
    return { result };
  }

  /**
   * Chain stream - uses pipe() chain
   */
  async chainStream(input: string) {
    return requirementChain.stream({ input });
  }

  /**
   * Chain batch - uses pipe() chain
   */
  async chainBatch(inputs: string[]): Promise<{ results: string[] }> {
    const results = await requirementChain.batch(inputs.map((input) => ({ input })));
    return { results };
  }

  /**
   * Structured output via withStructuredOutput (Requirement extraction)
   */
  async structured(input: string): Promise<{ result: RequirementResult }> {
    const result = await this.requirementService.extract(input);
    return { result };
  }

  /**
   * Render requirement prompt template without calling the model
   */
  async renderRequirementPromptPreview(input: string): Promise<{ rendered: string }> {
    const prompt = buildRequirementPrompt();
    const rendered = await prompt.invoke({ input });
    return { rendered: rendered.toString() };
  }

  /**
   * Render requirement prompt template and call the model
   */
  async renderRequirementPromptToModel(input: string): Promise<{ result: string }> {
    const prompt = buildRequirementPrompt();
    const messages = await prompt.formatMessages({ input });
    const response = await this.model.invoke(messages);
    return { result: response.content.toString() };
  }

  /**
   * Tool binding - bind tools to model and invoke
   */
  async toolBind(input: string): Promise<{ result: string, toolCalls: ToolCall[] }> {
    const modelWithTools = this.model.bindTools([
      checkConstraintValidityTool,
      lookupEntityDefinitionTool,
    ]);

    const response = await modelWithTools.invoke([
      new SystemMessage('你可以按需要调用工具来校验约束和查询实体定义。'),
      new HumanMessage(`请分析下面需求：${input}`),
    ]);

    return {
      result: response.content.toString(),
      toolCalls: response.tool_calls as ToolCall[],
    };
  }
  /**
   * Tool loop - bind tools and allow multiple tool calls in a loop
   */
  async toolLoop(input: string): Promise<{ result: string }> {
    const modelWithTools = this.model.bindTools(basicTools);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", REQUIREMENT_SYSTEM_PROMPT],
      ["human", REQUIREMENT_USER_TEMPLATE],
    ]);

    // Initial invocation
    const initialMessages = await prompt.formatMessages({ input });
    let response = await modelWithTools.invoke(initialMessages);

    // Loop for tool calls (max 5 iterations)
    let iterations = 0;
    const maxIterations = 5;
    let finalContent = "";

    while (iterations < maxIterations) {
      iterations++;

      if (response.tool_calls && response.tool_calls.length > 0) {
        // Process each tool call
        for (const toolCall of response.tool_calls) {
          // Call tool directly based on name
          if (toolCall.name === "check_constraint_validity") {
            const result = await checkConstraintValidityTool.invoke(
              toolCall.args as { constraint: string; context: string }
            );
            finalContent += `\n[Tool: ${toolCall.name}] ${JSON.stringify(result)}`;
          } else if (toolCall.name === "lookup_entity_definition") {
            const result = await lookupEntityDefinitionTool.invoke(
              toolCall.args as { entity: string }
            );
            finalContent += `\n[Tool: ${toolCall.name}] ${JSON.stringify(result)}`;
          }
        }
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalContent = response.content.toString();
        break;
      }

      // Continue conversation for next iteration
      response = await modelWithTools.invoke([
        ...initialMessages,
        new HumanMessage({ content: response.content.toString() }),
      ]);
    }

    return { result: finalContent };
  }

  /**
   * Retrieval - search documents using simple embedding similarity
   */
  async retrieval(query: string): Promise<{ answer: string; sources: string[] }> {
    // 3 sample documents
    const docs = [
      {
        pageContent: "registration-spec: 用户注册时必须填写用户名、密码和手机号。用户名为唯一标识，不可重复。",
        metadata: { source: "registration-spec" },
      },
      {
        pageContent: "password-policy: 密码要求至少8位，必须包含数字和字母，不能与用户名相同。",
        metadata: { source: "password-policy" },
      },
      {
        pageContent: "missing-info-rules: 当用户提交的信息不完整时，系统应提示用户补充必填项。",
        metadata: { source: "missing-info-rules" },
      },
    ];

    // Embed query and documents
    const embeddings = new OpenAIEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(query);
    const docEmbeddings = await Promise.all(
      docs.map((doc) => embeddings.embedQuery(doc.pageContent))
    );

    // Compute cosine similarity
    const similarities = docEmbeddings.map((docEmb, idx) => {
      const dot = queryEmbedding.reduce((sum, q, i) => sum + q * docEmb[i], 0);
      const normQ = Math.sqrt(queryEmbedding.reduce((s, v) => s + v * v, 0));
      const normD = Math.sqrt(docEmb.reduce((s, v) => s + v * v, 0));
      return { idx, score: dot / (normQ * normD) };
    });

    // Get top 2
    const top2 = similarities.sort((a, b) => b.score - a.score).slice(0, 2);
    const retrievedDocs = top2.map((t) => docs[t.idx]);

    // Build context from retrieved docs
    const context = retrievedDocs.map((doc) => doc.pageContent).join("\n");

    // Generate answer using model
    const response = await this.model.invoke([
      new SystemMessage("根据以下上下文信息回答用户问题。如果上下文没有相关信息，说明不知道。"),
      new HumanMessage(`上下文：\n${context}\n\n问题：${query}`),
    ]);

    return {
      answer: response.content.toString(),
      sources: retrievedDocs.map((doc) => doc.metadata?.source as string || "unknown"),
    };
  }
}
