import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getApiKeys } from '../config/load-langchain-config';

@Injectable()
export class EmbeddingService {
  private readonly embeddings: OpenAIEmbeddings;

  constructor() {
    const keys = getApiKeys();
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: keys.embeddingApiKey || keys.openaiApiKey,
      configuration: {
        baseURL: keys.openaiBaseUrl,
      },
      model: 'text-embedding-3-small',
    });
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}
