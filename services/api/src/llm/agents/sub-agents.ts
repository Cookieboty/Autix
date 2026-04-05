import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createChatModel } from '../model.factory';

const model = createChatModel();
const parser = new StringOutputParser();

export const extractAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是信息抽取专家。从客服对话中精确抽取以下字段，以纯 JSON 格式输出：
{{
  "orderId": "订单号，如 EC20240315001，没有则 null",
  "productId": "商品ID或名称",
  "requestType": "退货/退款/换货/咨询",
  "receivedDate": "收到商品日期，格式 YYYY-MM-DD，没有则 null",
  "isUnopened": true/false/null
}}

重要规则：
1. 只输出纯 JSON 对象，不要任何 markdown 代码块标记（不要 \`\`\`json 或 \`\`\`）
2. 不要添加任何额外说明或注释
3. 日期必须是 YYYY-MM-DD 格式，如"昨天"需要转换为具体日期
4. 今天日期：${new Date().toISOString().split('T')[0]}`,
  ],
  ['human', '{input}'],
]).pipe(model).pipe(parser);

export const policyCheckAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是退货政策核查专家。根据以下退货政策判断订单是否符合退货条件：
- 商品需在收到后 7 天内申请退货
- 商品必须未开封（isUnopened: true）
- 退款政策：符合退货条件则全额退款，运费由商家承担

今日日期：${new Date().toISOString().split('T')[0]}

请根据抽取结果 JSON 输出政策核查结论，包括：
1. 是否符合退货条件（符合/不符合/信息不足）
2. 判断依据
3. 如果不符合，说明原因

只输出文字说明，不要 JSON。`,
  ],
  ['human', '抽取结果：{extractResult}'],
]).pipe(model).pipe(parser);

export const riskReviewAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是风控审核专家。分析以下退货申请的抽取结果，识别并列出潜在风险点：
- 歧义信息（如日期模糊、商品描述不清）
- 冲突信息（如前后矛盾的陈述）
- 缺失关键信息（如缺少订单号、收货日期）
- 可疑行为模式

以列表形式输出风险点，每项以"·"开头。若无风险则输出"无明显风险"。`,
  ],
  ['human', '抽取结果：{extractResult}\n原始输入：{input}'],
]).pipe(model).pipe(parser);

export const qaAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是 QA 工程师。根据退货申请的抽取结果，生成 Given-When-Then 格式的验收条件：

格式示例：
Given: [前置条件]
When: [触发动作]
Then: [预期结果]

生成 2-3 个关键验收场景，覆盖正常流程和边界情况。`,
  ],
  ['human', '抽取结果：{extractResult}'],
]).pipe(model).pipe(parser);

export const summaryAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是退货案件汇总专家。根据各 Agent 的分析结果，生成最终退货判断报告。

报告格式：
## 退货申请分析报告

### 基本信息
[展示抽取的关键信息]

### 政策核查结论
[政策核查结果]

### 风险评估
[风险点列表]

### 验收条件
[QA 验收条件]

### 最终判断
[明确给出：批准退货 / 拒绝退货 / 需要补充信息，并说明理由]

### 建议处理步骤
[给客服的具体操作建议]`,
  ],
  [
    'human',
    `原始输入：{input}
抽取结果：{extractResult}
政策核查：{policyResult}
风险评估：{riskResult}
验收条件：{qaResult}`,
  ],
]).pipe(model).pipe(parser);
