import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { SearchResult } from './search.service';

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.documentsUncheckedCreateInput) {
    return this.prisma.documents.create({ data });
  }

  findByUser(userId: string) {
    return this.prisma.documents.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { document_chunks: true } } },
    });
  }

  findById(documentId: string) {
    return this.prisma.documents.findUnique({
      where: { id: documentId },
    });
  }

  findByIdWithChunks(documentId: string) {
    return this.prisma.documents.findUnique({
      where: { id: documentId },
      include: { document_chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
  }

  delete(documentId: string) {
    return this.prisma.documents.delete({ where: { id: documentId } });
  }

  updateStatus(documentId: string, status: string, chunkCount?: number) {
    return this.prisma.documents.update({
      where: { id: documentId },
      data: {
        status,
        ...(typeof chunkCount === 'number' ? { chunkCount } : {}),
      },
    });
  }

  deleteChunks(documentId: string) {
    return this.prisma.document_chunks.deleteMany({ where: { documentId } });
  }

  createChunk(documentId: string, content: string, chunkIndex: number) {
    return this.prisma.document_chunks.create({
      data: { documentId, content, chunkIndex },
    });
  }

  updateChunkEmbedding(chunkId: string, vector: string) {
    return this.prisma.$executeRaw`
      UPDATE document_chunks
      SET embedding = ${vector}::vector
      WHERE id = ${chunkId}
    `;
  }

  async similaritySearch(
    vectorLiteral: string,
    userId: string,
    topK: number,
  ): Promise<SearchResult[]> {
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
