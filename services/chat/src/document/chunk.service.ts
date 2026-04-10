import { Injectable, NotFoundException } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { extractText } from './parsers/parser.factory';

@Injectable()
export class ChunkService {
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async processDocument(documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    if (!doc.filePath) throw new NotFoundException('文档文件路径不存在');

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    try {
      const text = await extractText(doc.filePath, doc.mimeType);
      const chunks = await this.splitter.splitText(text);

      // 幂等：清除旧 chunks
      await this.prisma.documentChunk.deleteMany({ where: { documentId } });

      const vectors = await this.embedding.embedTexts(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const created = await this.prisma.documentChunk.create({
          data: { documentId, content: chunks[i], chunkIndex: i },
        });

        const vector = `[${vectors[i].join(',')}]`;
        await this.prisma.$executeRaw`
          UPDATE document_chunks
          SET embedding = ${vector}::vector
          WHERE id = ${created.id}
        `;
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'done', chunkCount: chunks.length },
      });
    } catch (err) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'error' },
      });
      throw err;
    }
  }
}
