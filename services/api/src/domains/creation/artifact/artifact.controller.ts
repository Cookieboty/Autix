import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { ArtifactService } from './artifact.service';
import { ConversationService } from '../conversation/conversation.service';
import {
  UpdateArtifactDto,
  UpdateTitleDto,
  OptimizeArtifactDto,
} from './dto';
import type { AuthUser } from '@autix/types';

@Controller('artifacts')
@UseGuards(JwtAuthGuard)
export class ArtifactController {
  constructor(
    private artifactService: ArtifactService,
    private conversationService: ConversationService,
  ) {}

  // GET /api/artifacts/conversation/:conversationId
  @Get('conversation/:conversationId')
  async getByConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const userId = getCurrentUserId(user);
    // 权限校验：通过会话权限
    await this.conversationService.findById(conversationId, userId);
    return this.artifactService.findByConversation(conversationId);
  }

  // GET /api/artifacts/:id
  @Get(':id')
  async getArtifact(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    // 权限校验：通过会话权限
    await this.conversationService.findById(artifact.conversationId, userId);
    return artifact;
  }

  // PUT /api/artifacts/:id
  @Put(':id')
  async updateArtifact(
    @Param('id') id: string,
    @Body() dto: UpdateArtifactDto,
    @CurrentUser() user: AuthUser,
  ) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    await this.conversationService.findById(artifact.conversationId, userId);
    return this.artifactService.updateArtifact(
      id,
      dto.content,
      dto.changelog,
    );
  }

  // PATCH /api/artifacts/:id/title
  @Patch(':id/title')
  async updateTitle(
    @Param('id') id: string,
    @Body() dto: UpdateTitleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    await this.conversationService.findById(artifact.conversationId, userId);
    return this.artifactService.updateTitle(id, dto.title);
  }

  // POST /api/artifacts/:id/optimize (SSE 流式)
  @Post(':id/optimize')
  async optimizeArtifact(
    @Param('id') id: string,
    @Body() dto: OptimizeArtifactDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    await this.conversationService.findById(artifact.conversationId, userId);

    // 流式优化
    return this.artifactService.optimizeArtifactStream(
      id,
      userId,
      dto.instruction,
      res,
    );
  }

  // GET /api/artifacts/:id/versions
  @Get(':id/versions')
  async getVersions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    await this.conversationService.findById(artifact.conversationId, userId);
    return this.artifactService.getVersions(id);
  }

  // POST /api/artifacts/:id/revert/:version
  @Post(':id/revert/:version')
  async revertToVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentUser() user: AuthUser,
  ) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    await this.conversationService.findById(artifact.conversationId, userId);
    return this.artifactService.revertToVersion(id, parseInt(version, 10));
  }

  // DELETE /api/artifacts/:id
  @Delete(':id')
  async deleteArtifact(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const userId = getCurrentUserId(user);
    const artifact = await this.artifactService.findById(id);
    await this.conversationService.findById(artifact.conversationId, userId);
    await this.artifactService.deleteArtifact(id);
    return { success: true };
  }
}
