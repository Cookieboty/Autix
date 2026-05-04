import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SearchService } from '../../../document/search.service';

export function createSearchDocumentsTool(searchService: SearchService, userId: string) {
  return tool(
    async (input) => {
      const results = await searchService.similaritySearch(input.query, userId, input.topK);
      if (results.length === 0) return '未找到相关文档片段。';
      return results
        .map((r, i) => `[文档片段 ${i + 1}]（相关度：${r.score.toFixed(3)}）\n${r.content}`)
        .join('\n\n');
    },
    {
      name: 'search_user_documents',
      description: '搜索用户已上传的文档，返回与查询最相关的片段。用于获取用户项目背景、需求等上下文信息。',
      schema: z.object({
        query: z.string().describe('搜索查询内容'),
        topK: z.number().optional().default(5).describe('返回最相关的前 N 条结果'),
      }),
    },
  );
}
