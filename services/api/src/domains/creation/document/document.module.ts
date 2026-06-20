import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { ChunkService } from './chunk.service';
import { EmbeddingService } from './embedding.service';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SseModule } from '../../platform/sse/sse.module';
import { SystemSettingsModule } from '../../platform/system-settings/system-settings.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { LibraryFeatureGuard } from './library-feature.guard';
import { DocumentRepository } from './document.repository';

@Module({
  imports: [SseModule, SystemSettingsModule, AuthModule],
  providers: [
    DocumentService,
    ChunkService,
    EmbeddingService,
    SearchService,
    LibraryFeatureGuard,
    DocumentRepository,
  ],
  controllers: [DocumentController, SearchController],
  exports: [SearchService],
})
export class DocumentModule {}
