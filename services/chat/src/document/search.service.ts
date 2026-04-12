import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    // vectorLiteral must be injected as a SQL literal (not a bind parameter) because
    // PostgreSQL cannot cast a text bind parameter to vector via $1::vector in prepared statements.
    // Prisma.raw() inlines it as SQL text. userId and topK remain parameterized (safe).
    // The vector values come from the model's float output — no user input reaches this string.
    const vectorLiteral = `[${vector.join(',')}]`;
    const vecRaw = Prisma.raw(`'${vectorLiteral}'::vector`);

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
        dc.id             AS chunk_id,
        dc."documentId"   AS document_id,
        dc.content        AS content,
        dc."chunkIndex"   AS chunk_index,
        1 - (dc.embedding <=> ${vecRaw}) AS score
      FROM document_chunks dc
      JOIN documents d ON d.id = dc."documentId"
      WHERE d."userId" = ${userId}
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> ${vecRaw}
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
