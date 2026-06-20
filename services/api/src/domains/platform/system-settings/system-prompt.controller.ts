import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { SystemPromptService } from './system-prompt.service';

@Controller('admin/system-prompts')
@UseGuards(AdminGuard)
export class SystemPromptController {
  constructor(private readonly systemPromptService: SystemPromptService) {}

  @Get()
  async list() {
    return this.systemPromptService.listPrompts();
  }

  @Post()
  async create(
    @Body()
    body: {
      key?: string;
      name?: string;
      description?: string | null;
      version?: string;
      content?: string;
      variables?: string[];
    },
  ) {
    return this.systemPromptService.createDraft({
      key: body.key ?? '',
      name: body.name ?? '',
      description: body.description,
      version: body.version ?? '',
      content: body.content ?? '',
      variables: body.variables,
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      version?: string;
      content?: string;
      variables?: string[];
    },
  ) {
    return this.systemPromptService.updateDraft(id, body);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    return this.systemPromptService.publish(id);
  }
}
