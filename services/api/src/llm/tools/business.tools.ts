import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import * as fs from 'fs/promises';
import * as path from 'path';

// Workspace root directory
const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace');

/**
 * Validate path is within workspace (sandbox)
 */
function safePath(relativePath: string): string {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const normalized = path.normalize(fullPath);

  if (!normalized.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path traversal detected: access denied');
  }

  return normalized;
}

/**
 * Tool: query_order
 * Query order details by order ID
 */
export const queryOrderTool = tool(
  async (input: { orderId: string }) => {
    try {
      const filePath = safePath(`orders/${input.orderId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const order = JSON.parse(content);
      return {
        success: true,
        orderId: input.orderId,
        data: order,
      };
    } catch (error: any) {
      return {
        success: false,
        orderId: input.orderId,
        error: error.code === 'ENOENT' ? '订单不存在' : error.message,
      };
    }
  },
  {
    name: 'query_order',
    description: '根据订单号查询订单详情，从 workspace/orders/{orderId}.json 读取',
    schema: z.object({
      orderId: z.string().describe('订单号，例如 EC20240315001'),
    }),
  }
);

/**
 * Tool: query_product
 * Query product details by product ID
 */
export const queryProductTool = tool(
  async (input: { productId: string }) => {
    try {
      const filePath = safePath(`products/${input.productId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const product = JSON.parse(content);
      return {
        success: true,
        productId: input.productId,
        data: product,
      };
    } catch (error: any) {
      return {
        success: false,
        productId: input.productId,
        error: error.code === 'ENOENT' ? '商品不存在' : error.message,
      };
    }
  },
  {
    name: 'query_product',
    description: '根据商品 ID 查询商品详情，从 workspace/products/{productId}.json 读取',
    schema: z.object({
      productId: z.string().describe('商品 ID，例如 PROD001'),
    }),
  }
);

/**
 * Tool: read_file
 * Read file content from workspace
 */
export const readFileTool = tool(
  async (input: { filePath: string }) => {
    try {
      const fullPath = safePath(input.filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        success: true,
        filePath: input.filePath,
        content,
      };
    } catch (error: any) {
      return {
        success: false,
        filePath: input.filePath,
        error: error.code === 'ENOENT' ? '文件不存在' : error.message,
      };
    }
  },
  {
    name: 'read_file',
    description: '读取 workspace/ 下指定路径的文件内容（政策、FAQ 等），路径相对于 workspace/',
    schema: z.object({
      filePath: z.string().describe('文件路径，例如 policies/return-policy.md'),
    }),
  }
);

/**
 * Tool: write_file
 * Write content to file in workspace
 */
export const writeFileTool = tool(
  async (input: { filePath: string; content: string }) => {
    try {
      const fullPath = safePath(input.filePath);

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, input.content, 'utf-8');
      return {
        success: true,
        filePath: input.filePath,
        message: '文件写入成功',
      };
    } catch (error: any) {
      return {
        success: false,
        filePath: input.filePath,
        error: error.message,
      };
    }
  },
  {
    name: 'write_file',
    description: '将内容写入 workspace/ 下指定路径（工单、报告），路径相对于 workspace/',
    schema: z.object({
      filePath: z.string().describe('文件路径，例如 tickets/EC20240315001-analysis.md'),
      content: z.string().describe('要写入的文件内容'),
    }),
  }
);

/**
 * Export all business tools
 */
export const businessTools = [
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
];
