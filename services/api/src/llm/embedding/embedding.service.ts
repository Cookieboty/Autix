import { Injectable } from '@nestjs/common';
import { Embeddings } from '@langchain/core/embeddings';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService extends Embeddings {
  private extractor: any = null;
  private readonly modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

  constructor() {
    super({});
  }

  private async getExtractor() {
    if (!this.extractor) {
      this.extractor = await pipeline(
        'feature-extraction',
        this.modelName
      );
    }
    return this.extractor;
  }

  /**
   * Embed a single query text
   */
  async embedQuery(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  /**
   * Embed multiple documents
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const doc of documents) {
      const embedding = await this.embedQuery(doc);
      results.push(embedding);
    }
    return results;
  }
}
