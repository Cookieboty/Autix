import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RunnableMemoryService } from './runnable-memory.service';

@Controller('api/memory')
export class MemoryController {
  constructor(private readonly memoryService: RunnableMemoryService) {}

  /**
   * POST /api/memory/chat
   * Multi-turn conversation with session memory
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: { sessionId: string; input: string }) {
    const { sessionId, input } = body;
    const result = await this.memoryService.chat(sessionId, input);
    return { sessionId, result };
  }

  /**
   * GET /api/memory/history
   * Get message history for a session
   */
  @Get('history')
  @HttpCode(HttpStatus.OK)
  async history(@Query('sessionId') sessionId: string) {
    const messages = await this.memoryService.getHistory(sessionId);
    return {
      sessionId,
      messages: messages.map((msg) => ({
        role: msg._getType(),
        content: msg.content,
      })),
    };
  }

  /**
   * DELETE /api/memory/clear
   * Clear session memory
   * Supports both query param and body
   */
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  async clear(@Query('sessionId') sessionId?: string, @Body() body?: { sessionId?: string }) {
    const sid = sessionId || body?.sessionId;
    if (!sid) {
      return { error: 'sessionId is required (via query param or body)' };
    }
    await this.memoryService.clearSession(sid);
    return { sessionId: sid, cleared: true };
  }
}
