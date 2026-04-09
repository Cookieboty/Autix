import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { MessageService } from '../message/message.service';
import { LlmService } from '../llm/llm.service';
import { DbChatHistory } from '../message/db-chat-history';
import { MessageRole } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('api/conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly llmService: LlmService,
  ) {}

  @Post()
  async create(@Req() req: Request, @Body() body: { title?: string }) {
    const userId = (req.user as any).userId;
    return this.conversationService.create(userId, body.title);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.conversationService.findByUser(userId);
  }

  @Get(':id/messages')
  async getMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req.user as any).userId;
    await this.conversationService.findById(id, userId);
    return this.messageService.getHistory(id, limit ? parseInt(limit) : undefined);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).userId;
    await this.conversationService.delete(id, userId);
  }

  @Post(':id/chat')
  async chat(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const userId = (req.user as any).userId;

    await this.conversationService.findById(id, userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await this.messageService.addMessage(id, MessageRole.USER, body.message);

    const chainWithHistory = this.llmService.buildRunnableWithHistory(
      (sessionId) => new DbChatHistory(sessionId, this.messageService),
    );

    try {
      const stream = await chainWithHistory.stream(
        { input: body.message },
        { configurable: { sessionId: id } },
      );

      let fullReply = '';
      for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (text) {
          res.write(`data: ${text}\n\n`);
          fullReply += text;
        }
      }

      await this.messageService.addMessage(id, MessageRole.ASSISTANT, fullReply);
      res.write('data: [DONE]\n\n');
    } catch (err) {
      res.write('data: [ERROR]\n\n');
    } finally {
      res.end();
    }
  }
}
