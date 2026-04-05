import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VectorStoreService } from './vector-store.service';

const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');

// Documents to seed on startup
const SEED_FILES = [
  {
    filePath: 'policies/return-policy.md',
    metadata: { source: 'return-policy', category: 'policy', topic: '退货政策' },
  },
  {
    filePath: 'policies/refund-policy.md',
    metadata: { source: 'refund-policy', category: 'policy', topic: '退款政策' },
  },
  {
    filePath: 'faq/after-sale-faq.md',
    metadata: { source: 'after-sale-faq', category: 'faq', topic: '售后常见问题' },
  },
];

@Injectable()
export class KnowledgeSeeder implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeSeeder.name);

  constructor(private readonly vectorStoreService: VectorStoreService) {}

  async onModuleInit() {
    // Run seeding asynchronously to not block startup
    this.seed().catch((err) =>
      this.logger.error(`[Seeder] Failed: ${err.message}`)
    );
  }

  private async seed() {
    this.logger.log('[Seeder] Starting knowledge base seeding...');
    const docs: { content: string; metadata: object }[] = [];

    for (const { filePath, metadata } of SEED_FILES) {
      try {
        const fullPath = path.join(WORKSPACE_ROOT, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Split by sections (## headings) to get meaningful chunks
        const chunks = this.splitIntoChunks(content, filePath);
        for (const chunk of chunks) {
          docs.push({ content: chunk, metadata });
        }

        this.logger.log(`[Seeder] Loaded ${chunks.length} chunks from ${filePath}`);
      } catch (err: any) {
        this.logger.warn(`[Seeder] Skipping ${filePath}: ${err.message}`);
      }
    }

    if (docs.length === 0) {
      this.logger.warn('[Seeder] No documents to seed');
      return;
    }

    await this.vectorStoreService.addDocuments(docs);
    this.logger.log(`[Seeder] Done. ${docs.length} chunks stored in vector DB`);
  }

  /**
   * Split markdown content into chunks by ## headings
   */
  private splitIntoChunks(content: string, source: string): string[] {
    const sections = content.split(/\n(?=## )/);
    return sections
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
  }
}
