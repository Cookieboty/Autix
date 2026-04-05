import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from '../src/llm/embedding/embedding.service';
import { VectorStoreService } from '../src/llm/embedding/vector-store.service';

describe('Embedding & Vector Store', () => {
  let embeddingService: EmbeddingService;
  let vectorStoreService: VectorStoreService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService, VectorStoreService],
    }).compile();

    embeddingService = module.get<EmbeddingService>(EmbeddingService);
    vectorStoreService = module.get<VectorStoreService>(VectorStoreService);

    // Wait for vector store initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it('should embed a query', async () => {
    const embedding = await embeddingService.embedQuery('如何申请退货？');
    console.log('Embedding dimension:', embedding.length);
    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should embed multiple documents', async () => {
    const docs = ['退货政策', '退款流程', '售后服务'];
    const embeddings = await embeddingService.embedDocuments(docs);
    console.log('Embeddings count:', embeddings.length);
    expect(embeddings.length).toBe(3);
  });

  it('should store and search documents', async () => {
    // Store test documents
    await vectorStoreService.addDocuments([
      {
        content: '七天无理由退货：签收后 7 天内可申请退货',
        metadata: { source: 'test', topic: '退货' },
      },
      {
        content: '退款时效：支付宝/微信 1-3 个工作日到账',
        metadata: { source: 'test', topic: '退款' },
      },
    ]);

    // Search
    const results = await vectorStoreService.similaritySearch('退货需要多久', 2);
    console.log('Search results:', JSON.stringify(results, null, 2));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toBeDefined();
  });
});
