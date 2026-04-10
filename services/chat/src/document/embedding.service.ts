/**
 * EmbeddingService — 本地向量生成
 *
 * 使用 @xenova/transformers (Transformers.js) 在 Node.js 环境运行。
 *
 * 模型: Xenova/paraphrase-multilingual-MiniLM-L12-v2
 *   - 12 层 Transformer Encoder（蒸馏版 BERT）
 *   - 输出维度: 384 维（符合 pgvector 16000 限制）
 *   - 支持 50+ 语言（含中文），专为短文本相似度优化
 *
 * 为什么不用 LangChain HuggingFaceTransformersEmbeddings:
 *   @langchain/community 的实现内部 import("@huggingface/transformers") v4，
 *   该包依赖 onnxruntime-node@1.24.3，与 @xenova/transformers@2.17.2
 *   不兼容（Tensor.location API 断裂）。因此直接使用 @xenova/transformers
 *   底层 API，绕过 LangChain 层。
 *
 * 流水线:
 *   1. feature-extraction pipeline 输出原始 hidden states  (batch, seq_len, hidden)
 *   2. mean_pooling() 根据 attention_mask 对 seq 维度加权平均  (batch, hidden)
 *   3. normalize(L2) 使向量单位长度，余弦相似度 = 点积
 *
 * pgvector 限制: 向量维度 ≤ 16000，MiniLM-L12-v2 输出 384 维，绰绰有余。
 */
import { Injectable } from '@nestjs/common';
import { pipeline, mean_pooling } from '@xenova/transformers';

@Injectable()
export class EmbeddingService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private embedder: any = null;
  private readonly modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

  /** 延迟初始化 pipeline（模型下载一次，后续复用） */
  private async getEmbedder() {
    if (!this.embedder) {
      this.embedder = await pipeline('feature-extraction', this.modelName);
    }
    return this.embedder;
  }

  /**
   * 将一组文本转为向量
   * @param texts 原文列表
   * @returns 向量列表，每项长度为 384
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    const embedder = await this.getEmbedder();
    // 换行符会影响 token 切分，统一替换为空格
    const cleanTexts = texts.map((t) => t.replace(/\n/g, ' '));

    // Step 1: 提取原始隐藏状态 (batch, seq_len, hidden)
    const rawOutput = await embedder(cleanTexts) as any;
    console.log('[Embedding] raw output shape:', rawOutput.dims, 'type:', rawOutput.type);

    // Step 2: 获取 token attention mask，手动做 mean pooling
    //         attention_mask 中 1 = 真实 token，0 = padding
    const tokenizer = embedder.tokenizer;
    const inputs = tokenizer(cleanTexts, { padding: true, truncation: true });
    const pooled = mean_pooling(rawOutput, inputs.attention_mask);

    // Step 3: L2 单位化，使余弦相似度 = 向量点积
    const normalized = pooled.normalize(2, -1);

    return normalized.tolist();
  }
}
