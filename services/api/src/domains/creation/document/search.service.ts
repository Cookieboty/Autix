import { Injectable } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { DocumentRepository } from './document.repository';

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  chunkIndex: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly embedding: EmbeddingService,
  ) {}

  async similaritySearch(
    query: string,
    userId: string,
    topK = 5,
  ): Promise<SearchResult[]> {
    const [vector] = await this.embedding.embedTexts([query]);
    if (!vector || vector.length === 0) {
      throw new Error('EmbeddingService returned no vector for query');
    }
    // vectorLiteral must be injected as a SQL literal (not a bind parameter) because
    // PostgreSQL cannot cast a text bind parameter to vector via $1::vector in prepared statements.
    // Prisma.raw() inlines it as SQL text. userId and topK remain parameterized (safe).
    // The vector values come from the model's float output — no user input reaches this string.
    const vectorLiteral = `[${vector.join(',')}]`;
    return this.documentRepository.similaritySearch(vectorLiteral, userId, topK);
  }
}
