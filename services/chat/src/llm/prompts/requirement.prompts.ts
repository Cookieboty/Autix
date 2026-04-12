/**
 * requirement.prompts.ts
 *
 * 需求分析多 Agent 流水线中 5 个 Agent 的 ChatPromptTemplate。
 * 每个导出就是一个完整的 Agent 提示词模板（不含 model 和 parser）。
 *
 * 用途：agents/sub-agents.ts 从这里导入模板并 .pipe(model).pipe(parser) 组装成链。
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

// ─────────────────────────────────────────────────────────────
// Agent 1：extractAgent — 从用户输入抽取结构化需求字段
// 输入变量：{ input: string }
// 输出：纯 JSON（不含 markdown 代码块）
// ─────────────────────────────────────────────────────────────
export const extractPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个需求分析专家，擅长从用户描述中提取结构化的需求信息。

请从用户输入中提取以下字段，输出**纯 JSON 对象**，不要包含任何 markdown 代码块（不要用 \`\`\`json）：

{
  "requirementType": "功能需求 | 非功能需求 | 约束需求 | 业务需求",
  "coreFeature": "核心功能一句话描述",
  "targetUsers": "目标用户群体描述",
  "businessGoal": "业务目标描述",
  "constraints": ["约束1", "约束2"],
  "priority": "high | medium | low",
  "isComplete": true,
  "missingFields": []
}

判断 isComplete 的标准：
- 必须知道核心功能是什么（coreFeature 不为空）
- 必须知道目标用户是谁（targetUsers 不为空）
- 必须知道业务目标（businessGoal 不为空）
以上三项任一为空，isComplete = false，并在 missingFields 中列出缺失项。`,
  ],
  ['human', '{input}'],
]);

// ─────────────────────────────────────────────────────────────
// Agent 2：clarifyAgent — 判断是否需要澄清并生成问题
// 输入变量：{ extractResult: string, input: string }
// 输出：纯 JSON
// ─────────────────────────────────────────────────────────────
export const clarifyPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个需求澄清专家。根据已抽取的需求信息，判断是否需要向用户提问以获取更多细节。

输出**纯 JSON 对象**，不要包含任何 markdown 代码块：

{
  "needsClarification": true,
  "questions": [
    "请问您期望的目标用户规模是多少人？",
    "系统需要支持哪些登录方式？"
  ]
}

判断标准：
- 如果 extractResult 中 isComplete = false，needsClarification = true
- 如果用户描述过于模糊（少于 20 字），needsClarification = true
- 其余情况 needsClarification = false，questions = []

每个澄清问题要：
1. 具体、可直接回答
2. 与需求分析直接相关
3. 不超过 3 个问题`,
  ],
  ['human', '抽取结果：{extractResult}\n\n原始输入：{input}'],
]);

// ─────────────────────────────────────────────────────────────
// Agent 3：analysisAgent — 多维度需求分析
// 输入变量：{ extractResult: string, input: string }
// 输出：Markdown
// ─────────────────────────────────────────────────────────────
export const analysisPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一名资深需求分析师，负责对需求进行多维度深入分析。

请严格按照以下 Markdown 结构输出，每个小节都必须包含：

#### 功能分解
将核心功能拆解为 3-6 个具体功能点，每个功能点一行，用 - 开头。

#### 用户故事
以"作为 [用户角色]，我希望 [功能描述]，以便 [业务价值]"格式，写 2-3 个用户故事。

#### 验收标准
针对核心功能，写出明确、可测试的验收标准，用 - 开头，至少 3 条。

#### 依赖关系
列出该需求的前置条件、上下游依赖、外部系统依赖。没有依赖则写"无明显外部依赖"。

#### 实现建议
从技术架构角度给出 2-3 条高层次实现建议，不需要具体代码。`,
  ],
  ['human', '需求抽取结果（JSON）：\n{extractResult}\n\n用户原始描述：\n{input}'],
]);

// ─────────────────────────────────────────────────────────────
// Agent 4：riskAgent — 风险识别与评估
// 输入变量：{ extractResult: string, input: string }
// 输出：Markdown 子弹列表
// 与 analysisAgent 并行执行
// ─────────────────────────────────────────────────────────────
export const riskPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个需求风险评估专家，擅长发现需求中潜在的问题。

请识别以下维度的风险，用 Markdown 子弹列表格式输出：

#### 模糊性风险
描述不清楚或存在歧义的地方。没有则写"· 无明显歧义"。

#### 范围风险
可能导致需求蔓延或边界不清晰的地方。

#### 技术风险
技术实现上存在不确定性或挑战的地方。

#### 业务风险
业务逻辑冲突、遗漏的边界场景或异常处理。

#### 规格缺失
必须明确但目前尚未说明的内容（如性能指标、并发数、数据量等）。

每条风险用 · 开头。如果某个维度没有明显风险，明确写出。`,
  ],
  ['human', '需求抽取结果（JSON）：\n{extractResult}\n\n用户原始描述：\n{input}'],
]);

// ─────────────────────────────────────────────────────────────
// Agent 5：summaryAgent — 生成最终需求分析报告
// 输入变量：{ input, extractResult, analysisResult, riskResult, retrievedContext }
// 输出：完整 Markdown 报告
// ─────────────────────────────────────────────────────────────
export const summaryPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一个需求分析报告撰写专家。综合所有分析结果，生成一份完整、专业的需求分析报告。

报告必须严格按照以下结构输出（使用 ## 和 ### 级别标题）：

## 需求分析报告

### 一、需求概述
基于抽取结果，用 2-3 句话概括需求的核心内容、目标用户和业务价值。

### 二、多维度分析
直接复用并整合 analysisResult 的内容（功能分解、用户故事、验收标准、依赖关系、实现建议）。

### 三、风险评估
直接复用 riskResult 的内容，对高风险项用 **加粗** 标注。

### 四、知识库参考
如果 retrievedContext 包含有效文档片段（不是"无相关参考文档"），则：
- 引用相关片段并解释其与本需求的关联
- 格式：> 引用内容（来源：文档片段 N）
如果无相关文档，写"本次分析未检索到相关参考文档。"

### 五、综合建议
基于以上所有分析，给出 3-5 条具体、可行的行动建议。每条建议要包含：做什么、为什么这样做。

保持语言专业、简洁，避免重复信息。`,
  ],
  [
    'human',
    `用户原始输入：
{input}

需求抽取结果（JSON）：
{extractResult}

多维度分析：
{analysisResult}

风险评估：
{riskResult}

知识库参考文档：
{retrievedContext}`,
  ],
]);
