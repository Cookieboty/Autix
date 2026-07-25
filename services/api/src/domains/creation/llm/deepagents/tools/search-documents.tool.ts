import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SearchService } from '../../../document/search.service';

export function createSearchDocumentsTool(searchService: SearchService, userId: string) {
  return tool(
    async (input) => {
      const results = await searchService.similaritySearch(input.query, userId, input.topK);
      if (results.length === 0) return 'No relevant document snippets found.';
      return results
        .map((r, i) => `[Document snippet ${i + 1}] (relevance: ${r.score.toFixed(3)})\n${r.content}`)
        .join('\n\n');
    },
    {
      name: 'search_user_documents',
      description: "Search the user's uploaded documents and return the snippets most relevant to the query. Used to obtain context such as the user's project background and requirements.",
      schema: z.object({
        query: z.string().describe('Search query'),
        topK: z.number().optional().default(5).describe('Return the top N most relevant results'),
      }),
    },
  );
}
