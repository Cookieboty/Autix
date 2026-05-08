import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function extractAmuxHeaders(req: Request) {
  const baseUrl = req.headers['x-amux-base-url'] as string | undefined;
  const apiKey = req.headers['x-amux-api-key'] as string | undefined;
  if (!baseUrl || !apiKey) {
    throw new BadRequestException('Missing X-Amux-Base-Url or X-Amux-Api-Key headers');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

@UseGuards(JwtAuthGuard)
@Controller('image-gen')
export class ImageGenController {

  @Post('generate')
  async generate(@Req() req: Request, @Res() res: Response) {
    const { baseUrl, apiKey } = extractAmuxHeaders(req);
    const upstream = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  }

  @Post('chat')
  async chat(@Req() req: Request, @Res() res: Response) {
    const { baseUrl, apiKey } = extractAmuxHeaders(req);
    const body = req.body;
    const isStream = body?.stream === true;

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    res.status(upstream.status);

    if (isStream && upstream.body) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        res.end();
      }
      return;
    }

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  }

  @Get('models')
  async models(@Req() req: Request, @Res() res: Response) {
    const { baseUrl, apiKey } = extractAmuxHeaders(req);
    const upstream = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  }
}
