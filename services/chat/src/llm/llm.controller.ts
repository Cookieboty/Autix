import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { LlmService } from "./llm.service";

@Controller("chat/langchain")
export class LlmController {
  constructor(private readonly llmService: LlmService) { }

  @Post("invoke")
  @HttpCode(HttpStatus.OK)
  async invoke(@Body() body: { input: string }) {
    const result = await this.llmService.invokeDemo(body.input);
    return { result };
  }

  @Post("stream")
  @HttpCode(HttpStatus.OK)
  async stream(@Body() body: { input: string }, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await this.llmService.streamDemo(body.input);

    for await (const chunk of stream) {
      res.write(chunk.content);
    }

    res.end();
  }

  @Post("batch")
  @HttpCode(HttpStatus.OK)
  async batch(@Body() body: { inputs: string[] }) {
    const results = await this.llmService.batchDemo(body.inputs);
    return { results };
  }

  @Post("prompt-preview")
  @HttpCode(HttpStatus.OK)
  async promptPreview(@Body() body: { input: string }) {
    const result = await this.llmService.renderPromptPreview(body.input);
    return result;
  }

  @Post("prompt-to-model")
  @HttpCode(HttpStatus.OK)
  async promptToModel(@Body() body: { input: string }) {
    const result = await this.llmService.renderPromptToModel(body.input);
    return result;
  }

  @Post("chain-invoke")
  @HttpCode(HttpStatus.OK)
  async chainInvoke(@Body() body: { input: string }) {
    const result = await this.llmService.chainInvoke(body.input);
    return result;
  }

  @Post("chain-stream")
  @HttpCode(HttpStatus.OK)
  async chainStream(@Body() body: { input: string }, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await this.llmService.chainStream(body.input);

    for await (const chunk of stream) {
      res.write(chunk);
    }

    res.end();
  }

  @Post("chain-batch")
  @HttpCode(HttpStatus.OK)
  async chainBatch(@Body() body: { inputs: string[] }) {
    const result = await this.llmService.chainBatch(body.inputs);
    return result;
  }

  @Post("structured")
  @HttpCode(HttpStatus.OK)
  async structured(@Body() body: { input: string }) {
    const result = await this.llmService.structured(body.input);
    return result;
  }

  @Post("requirement-prompt-preview")
  @HttpCode(HttpStatus.OK)
  async requirementPromptPreview(@Body() body: { input: string }) {
    const result = await this.llmService.renderRequirementPromptPreview(body.input);
    return result;
  }

  @Post("requirement-prompt-to-model")
  @HttpCode(HttpStatus.OK)
  async requirementPromptToModel(@Body() body: { input: string }) {
    const result = await this.llmService.renderRequirementPromptToModel(body.input);
    return result;
  }

  @Post("tool-bind")
  @HttpCode(HttpStatus.OK)
  async toolBind(@Body() body: { input: string }) {
    const result = await this.llmService.toolBind(body.input);
    return result;
  }

  @Post("tool-loop")
  @HttpCode(HttpStatus.OK)
  async toolLoop(@Body() body: { input: string }) {
    const result = await this.llmService.toolLoop(body.input);
    return result;
  }

  @Post("retrieval")
  @HttpCode(HttpStatus.OK)
  async retrieval(@Body() body: { question: string }) {
    const result = await this.llmService.retrieval(body.question);
    return result;
  }
}
