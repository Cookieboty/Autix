import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';

@Controller('api/embedding')
export class EmbeddingController {
  constructor(private readonly vectorStoreService: VectorStoreService) {}

  /**
   * POST /api/embedding/store
   * Store documents in vector database
   */
  @Post('store')
  @HttpCode(HttpStatus.OK)
  async store(
    @Body() body: { documents: { content: string; metadata: object }[] }
  ) {
    const { documents } = body;
    await this.vectorStoreService.addDocuments(documents);
    return {
      success: true,
      count: documents.length,
      message: `${documents.length} documents stored successfully`,
    };
  }

  /**
   * POST /api/embedding/search
   * Search similar documents
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() body: { query: string; topK?: number }) {
    const { query, topK = 3 } = body;
    const results = await this.vectorStoreService.similaritySearch(query, topK);
    return {
      query,
      topK,
      results,
    };
  }
}
