import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { ChunkService } from './chunk.service';
import { EmbeddingService } from './embedding.service';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [SseModule],
  providers: [DocumentService, ChunkService, EmbeddingService, SearchService],
  controllers: [DocumentController, SearchController],
})
export class DocumentModule {}
