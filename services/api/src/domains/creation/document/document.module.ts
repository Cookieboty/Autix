import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { ChunkService } from './chunk.service';
import { EmbeddingService } from './embedding.service';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SseModule } from '../../platform/sse/sse.module';
import { SystemSettingsModule } from '../../platform/system-settings/system-settings.module';
import { LibraryFeatureGuard } from './library-feature.guard';

@Module({
  imports: [SseModule, SystemSettingsModule],
  providers: [DocumentService, ChunkService, EmbeddingService, SearchService, LibraryFeatureGuard],
  controllers: [DocumentController, SearchController],
  exports: [SearchService],
})
export class DocumentModule {}
