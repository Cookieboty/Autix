import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { ChunkService } from './chunk.service';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [DocumentService, ChunkService, EmbeddingService],
  controllers: [DocumentController],
})
export class DocumentModule {}
