import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { SseService } from '../sse/sse.service';
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
    private readonly sseService: SseService,
  ) {}

  async processDocument(documentId: string, userId: string): Promise<void> {
    const doc = await this.prisma.documents.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('文档不存在');
    if (!doc.filePath) throw new NotFoundException('文档文件路径不存在');

    // 发送"开始"事件
    await this.sseService.emit(userId, {
      id: uuid(),
      taskType: 'document_vectorize',
      taskId: documentId,
      status: 'processing',
      message: '开始向量化',
      createdAt: new Date().toISOString(),
    });

    await this.prisma.documents.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    try {
      const text = await extractText(doc.filePath, doc.mimeType);
      const chunks = await this.splitter.splitText(text);

      await this.prisma.document_chunks.deleteMany({ where: { documentId } });

      const vectors = await this.embedding.embedTexts(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const created = await this.prisma.document_chunks.create({
          data: { documentId, content: chunks[i], chunkIndex: i },
        });

        const vector = `[${vectors[i].join(',')}]`;
        await this.prisma.$executeRaw`
          UPDATE document_chunks
          SET embedding = ${vector}::vector
          WHERE id = ${created.id}
        `;
      }

      // 发送"完成"事件
      await this.sseService.emit(userId, {
        id: uuid(),
        taskType: 'document_vectorize',
        taskId: documentId,
        status: 'done',
        message: `向量化完成，共 ${chunks.length} 个 chunk`,
        metadata: { chunkCount: chunks.length },
        createdAt: new Date().toISOString(),
      });

      await this.prisma.documents.update({
        where: { id: documentId },
        data: { status: 'done', chunkCount: chunks.length },
      });
    } catch (err) {
      // 发送"错误"事件
      await this.sseService.emit(userId, {
        id: uuid(),
        taskType: 'document_vectorize',
        taskId: documentId,
        status: 'error',
        message: err instanceof Error ? err.message : '向量化失败',
        createdAt: new Date().toISOString(),
      });
      await this.prisma.documents.update({
        where: { id: documentId },
        data: { status: 'error' },
      });
      throw err;
    }
  }
}
