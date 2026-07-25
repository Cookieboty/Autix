import { HttpStatus, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { EmbeddingService } from './embedding.service';
import { SseService } from '../../platform/sse/sse.service';
import { extractText } from './parsers/parser.factory';
import { DocumentRepository } from './document.repository';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

@Injectable()
export class ChunkService {
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly embedding: EmbeddingService,
    private readonly sseService: SseService,
  ) { }

  async processDocument(documentId: string, userId: string): Promise<void> {
    const doc = await this.documentRepository.findById(documentId);
    if (!doc) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'document.not_found');
    if (!doc.filePath) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'document.file_path_missing');

    await this.sseService.emit(userId, {
      id: uuid(),
      taskType: 'document_vectorize',
      taskId: documentId,
      status: 'processing',
      message: 'Start vectorization',
      createdAt: new Date().toISOString(),
    });

    await this.documentRepository.updateStatus(documentId, 'processing');

    try {
      const text = await extractText(doc.filePath, doc.mimeType);
      const chunks = await this.splitter.splitText(text);

      await this.documentRepository.deleteChunks(documentId);

      const vectors = await this.embedding.embedTexts(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const created = await this.documentRepository.createChunk(
          documentId,
          chunks[i],
          i,
        );

        const vector = `[${vectors[i].join(',')}]`;
        await this.documentRepository.updateChunkEmbedding(created.id, vector);
      }

      await this.sseService.emit(userId, {
        id: uuid(),
        taskType: 'document_vectorize',
        taskId: documentId,
        status: 'done',
        message: `Vectorization complete, total ${chunks.length} chunks`,
        metadata: { chunkCount: chunks.length },
        createdAt: new Date().toISOString(),
      });

      await this.documentRepository.updateStatus(documentId, 'done', chunks.length);
    } catch (err) {
      await this.sseService.emit(userId, {
        id: uuid(),
        taskType: 'document_vectorize',
        taskId: documentId,
        status: 'error',
        message: err instanceof Error ? err.message : 'Vectorization failed',
        createdAt: new Date().toISOString(),
      });
      await this.documentRepository.updateStatus(documentId, 'error');
      throw err;
    }
  }
}
