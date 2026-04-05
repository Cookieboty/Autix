import { Injectable, OnModuleInit } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { EmbeddingService } from './embedding.service';

interface StoredDocument {
  document: Document;
  embedding: number[];
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private documents: StoredDocument[] = [];

  constructor(private readonly embeddingService: EmbeddingService) {}

  async onModuleInit() {
    console.log(`[VectorStore] Memory vector store initialized`);
  }

  /**
   * Add documents to the vector store
   */
  async addDocuments(
    docs: { content: string; metadata: object }[]
  ): Promise<void> {
    for (const doc of docs) {
      const document = new Document({
        pageContent: doc.content,
        metadata: doc.metadata,
      });
      const embedding = await this.embeddingService.embedQuery(doc.content);
      this.documents.push({ document, embedding });
    }
    console.log(`[VectorStore] Added ${docs.length} documents, total: ${this.documents.length}`);
  }

  /**
   * Similarity search using cosine similarity
   */
  async similaritySearch(
    query: string,
    topK: number = 3
  ): Promise<{ content: string; metadata: object; score: number }[]> {
    if (this.documents.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddingService.embedQuery(query);

    // Calculate cosine similarity for each document
    const scores = this.documents.map((stored) => {
      const similarity = this.cosineSimilarity(queryEmbedding, stored.embedding);
      return {
        content: stored.document.pageContent,
        metadata: stored.document.metadata,
        score: similarity,
      };
    });

    // Sort by score descending and return top K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
