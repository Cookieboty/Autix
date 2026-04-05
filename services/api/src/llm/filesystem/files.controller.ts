import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesystemService } from './filesystem.service';

@Controller('api/files')
export class FilesController {
  constructor(private readonly filesystemService: FilesystemService) {}

  /**
   * POST /api/files/file-chat
   * Chat with file system tools
   */
  @Post('file-chat')
  @HttpCode(HttpStatus.OK)
  async fileChat(@Body() body: { input: string }) {
    const { input } = body;
    const response = await this.filesystemService.fileChat(input);
    return response;
  }

  /**
   * POST /api/files/file-chat-stream
   * Chat with file system tools (streaming response to avoid timeout)
   */
  @Post('file-chat-stream')
  @HttpCode(HttpStatus.OK)
  async fileChatStream(@Body() body: { input: string }, @Res() res: Response) {
    const { input } = body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Send progress updates
      res.write(`data: ${JSON.stringify({ type: 'start', message: '开始处理...' })}\n\n`);

      const response = await this.filesystemService.fileChat(input);

      // Send tool calls
      for (const toolCall of response.toolCalls) {
        res.write(`data: ${JSON.stringify({ type: 'tool', data: toolCall })}\n\n`);
      }

      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'result', data: response.result })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    }

    res.end();
  }
}
