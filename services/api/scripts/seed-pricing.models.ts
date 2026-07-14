/**
 * 起步模型目录（SEED_MODELS）——从 seed-pricing.ts 抽出来的**纯数据/纯函数**模块。
 *
 * 那个文件在模块顶层就 `createPrismaClient()`，并在文件末尾无条件调用 `main()`
 * （没有 `require.main === module` 之类的守卫）——一 import 就会真的连数据库、跑一遍
 * seed 流程。SEED_MODELS 因此永远测不到，除非把它和纯函数一起搬出来（同
 * seed-pricing.schemas.ts 的拆分理由，AGENTS.md 拆分优先级第 1 条）。
 */

/**
 * type + capabilities 决定 presetKeyFor 的归类（→ text / image / video preset）；
 * metadata.imageModelKind / videoModelKind 给能力面板（尺寸/分辨率）做确定性识别，
 * 避免 model-id 变了之后识别不出档位。
 */
export interface SeedModelRow {
  name: string;
  provider: string;
  model: string;
  type: 'general' | 'video';
  capabilities: string[];
  isDefault: boolean;
  metadata: Record<string, unknown>;
  description: Record<string, string>;
}

/**
 * 图片模型 metadata 的协议三件套（protocolKey / operations / limits）+ 展示用
 * modelFamily。取值**必须与 IMAGE_MODEL_CAPABILITIES 一致**——`supportsSourceImage`
 * 决定 operations 是否含 'edit'，`maxCount` 直接抄能力表；用这个 helper 生成而不是
 * 手抄字面量，避免第 3 期删掉能力表前两份配置分叉（spec §7.2 的构建期校验就是防这个）。
 * 所有图片模型走同一套网关协议（spec §7.3 的决议），故 protocolKey 恒为
 * gatewayOpenAIV1.key，不按 kind 分支。
 */
/** 任务-模型绑定的默认加价倍率（2 = 原始成本上加 100% 毛利）。运营可逐条调整。 */
export const DEFAULT_MULTIPLIER = 2;

/**
 * 起步模型目录。型号取自 domain 的能力表（image/video capabilities.ts 里真实登记的
 * kind）与 seed-prod 的首页任务（Nano Banana Pro / Seedance 2.0）。**不写 apiKey /
 * baseUrl**——密钥与网关地址由运营在 admin「模型配置」页手动补充。model-id 的 amux/
 * 前缀只是占位命名，运营按真实网关改。
 */
export const SEED_MODELS: SeedModelRow[] = [
  // —— 对话 / 文本（text preset）——
  // 各家主流对话模型系列。model-id 按 2026-07 官网核对的当前版本给出（见提交说明的来源），
  // 但 amux 网关的实际 id 命名可能不同（前缀/日期后缀），运营需按 amux 的 /models 清单最终核对。
  // 全部走 text preset（token 计价）。
  // OpenAI GPT-5.6（Sol/Terra/Luna 三档）+ 5.5
  { name: 'GPT-5.6 Sol', provider: 'amux', model: 'gpt-5.6-sol', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: true, metadata: {}, description: { en: 'OpenAI flagship model', 'zh-CN': 'OpenAI 旗舰模型' } },
  { name: 'GPT-5.6 Terra', provider: 'amux', model: 'gpt-5.6-terra', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI balanced model', 'zh-CN': 'OpenAI 均衡模型' } },
  { name: 'GPT-5.6 Luna', provider: 'amux', model: 'gpt-5.6-luna', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI fast / low-cost model', 'zh-CN': 'OpenAI 快速经济模型' } },
  { name: 'GPT-5.5', provider: 'amux', model: 'gpt-5.5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'OpenAI previous-gen chat model', 'zh-CN': 'OpenAI 上一代对话模型' } },
  // Anthropic Claude（Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5，id 用连字符）
  { name: 'Claude Fable 5', provider: 'amux', model: 'claude-fable-5', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Anthropic top-tier model', 'zh-CN': 'Anthropic 顶级模型' } },
  { name: 'Claude Opus 4.8', provider: 'amux', model: 'claude-opus-4-8', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Anthropic flagship model', 'zh-CN': 'Anthropic 旗舰模型' } },
  { name: 'Claude Sonnet 5', provider: 'amux', model: 'claude-sonnet-5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Anthropic balanced model', 'zh-CN': 'Anthropic 均衡模型' } },
  { name: 'Claude Haiku 4.5', provider: 'amux', model: 'claude-haiku-4-5', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Anthropic fast model', 'zh-CN': 'Anthropic 快速模型' } },
  // DeepSeek V4（chat/reasoner 于 2026-07-24 弃用，改用 v4-pro/flash）
  { name: 'DeepSeek V4 Pro', provider: 'amux', model: 'deepseek-v4-pro', type: 'general', capabilities: ['text', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'DeepSeek high-quality model', 'zh-CN': 'DeepSeek 高质量模型' } },
  { name: 'DeepSeek V4 Flash', provider: 'amux', model: 'deepseek-v4-flash', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'DeepSeek fast model', 'zh-CN': 'DeepSeek 快速模型' } },
  // 智谱 GLM 5.2 / 5.1
  { name: 'GLM-5.2', provider: 'amux', model: 'glm-5.2', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Zhipu GLM flagship model', 'zh-CN': '智谱 GLM 旗舰模型' } },
  { name: 'GLM-5.1', provider: 'amux', model: 'glm-5.1', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Zhipu GLM model', 'zh-CN': '智谱 GLM 模型' } },
  // Google Gemini 3.5
  { name: 'Gemini 3.5 Pro', provider: 'amux', model: 'gemini-3.5-pro', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'Google Gemini flagship model', 'zh-CN': 'Google Gemini 旗舰模型' } },
  { name: 'Gemini 3.5 Flash', provider: 'amux', model: 'gemini-3.5-flash', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Google Gemini fast model', 'zh-CN': 'Google Gemini 快速模型' } },
  // 阿里 Qwen 3.7
  { name: 'Qwen3.7 Max', provider: 'amux', model: 'qwen3.7-max', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen flagship model', 'zh-CN': '阿里通义千问旗舰模型' } },
  { name: 'Qwen3.7 Plus', provider: 'amux', model: 'qwen3.7-plus', type: 'general', capabilities: ['text', 'vision'], isDefault: false, metadata: {}, description: { en: 'Alibaba Qwen multimodal model', 'zh-CN': '阿里通义千问多模态模型' } },
  // Moonshot Kimi K2.6 / xAI Grok 4.3
  { name: 'Kimi K2.6', provider: 'amux', model: 'kimi-k2.6', type: 'general', capabilities: ['text'], isDefault: false, metadata: {}, description: { en: 'Moonshot Kimi model', 'zh-CN': '月之暗面 Kimi 模型' } },
  { name: 'Grok 4.3', provider: 'amux', model: 'grok-4.3', type: 'general', capabilities: ['text', 'vision', 'reasoning'], isDefault: false, metadata: {}, description: { en: 'xAI Grok model', 'zh-CN': 'xAI Grok 模型' } },

  // —— 图像 ——
  // **metadata 留空**：协议路由（protocolKey）、能力（operations / limits）、参数
  // （paramsSchema）全部由运营在 admin 模型配置页填，存 DB。seed 不猜、不写死——
  // 每个模型支持哪些参数、走哪个协议、上传几张图，逐模型都不同。
  // seed 只负责「库里没有这个模型就建一行」。
  { name: 'GPT Image 2', provider: 'amux', model: 'gpt-image-2-official', type: 'general', capabilities: ['image'], isDefault: true, metadata: {}, description: { en: 'OpenAI image model', 'zh-CN': 'OpenAI 图像模型' } },
  { name: 'Nano Banana Pro', provider: 'amux', model: 'gemini-3-pro-image-preview', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'Nano Banana Pro', 'zh-CN': 'Nano Banana Pro' } },
  { name: 'Nano Banana Fast', provider: 'amux', model: 'gemini-3.1-flash-image-preview', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'Nano Banana Fast', 'zh-CN': 'Nano Banana Fast' } },
  { name: 'Nano Banana 2 Lite', provider: 'amux', model: 'gemini-3.1-flash-lite-image', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'Nano Banana 2 Lite', 'zh-CN': 'Nano Banana 2 Lite' } },
  { name: 'Gemini 2.5 Flash Image', provider: 'amux', model: 'gemini-2.5-flash-image', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'Google Gemini image model', 'zh-CN': 'Google Gemini 图像模型' } },
  { name: 'Seedream 4.5', provider: 'amux', model: 'doubao-seedream-4-5', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'ByteDance Seedream image model', 'zh-CN': '字节 Seedream 图像模型' } },
  { name: 'Seedream 5.0 Lite', provider: 'amux', model: 'doubao-seedream-5-0-lite', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'ByteDance Seedream lite model', 'zh-CN': '字节 Seedream 轻量模型' } },
  { name: 'MiniMax Image 01', provider: 'amux', model: 'MiniMax-Image-01', type: 'general', capabilities: ['image'], isDefault: false, metadata: {}, description: { en: 'MiniMax image model', 'zh-CN': 'MiniMax 图像模型' } },

  // —— 视频（video preset）—— 只保留 Seedance 2.0 系列（线上真实 id）；metadata.videoModelKind 定档
  { name: 'Seedance 2.0', provider: 'amux', model: 'doubao-seedance-2.0', type: 'video', capabilities: ['video'], isDefault: true, metadata: { videoModelKind: 'seedance-2.0' }, description: { en: 'Seedance video model', 'zh-CN': 'Seedance 视频模型' } },
  { name: 'Seedance 2.0 Fast', provider: 'amux', model: 'doubao-seedance-2.0-fast', type: 'video', capabilities: ['video'], isDefault: false, metadata: { videoModelKind: 'seedance-2.0-fast' }, description: { en: 'Seedance fast video model', 'zh-CN': 'Seedance 快速视频模型' } },
];
