import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

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
    private readonly prisma: PrismaService,
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
    const vectorLiteral = `[${vector.join(',')}]`;

    // vectorLiteral is bound as a parameterized value by Prisma's $queryRaw tagged template.
    // Do NOT convert this to $queryRawUnsafe — that would make the vector string SQL-injectable.
    const rows = await this.prisma.$queryRaw<
      Array<{
        chunk_id: string;
        document_id: string;
        content: string;
        score: string | number;
        chunk_index: number;
      }>
    >`
      SELECT
        dc.id          AS chunk_id,
        dc.document_id AS document_id,
        dc.content     AS content,
        dc.chunk_index AS chunk_index,
        1 - (dc.embedding <=> ${vectorLiteral}::vector) AS score
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE d."userId" = ${userId}
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      content: r.content,
      score: Number(r.score),
      chunkIndex: r.chunk_index,
    }));
  }
}
