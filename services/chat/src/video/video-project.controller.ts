import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, Subject } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  VideoProjectService,
  type CreateProjectDto,
  type AddClipDto,
  type UpdateClipDto,
  type AddMaterialDto,
} from './video-project.service';
import { VideoGenerationFlowService } from './video-generation-flow.service';

@UseGuards(JwtAuthGuard)
@Controller('video-projects')
export class VideoProjectController {
  constructor(
    private readonly projectService: VideoProjectService,
    private readonly generationFlow: VideoGenerationFlowService,
  ) {}

  @Post()
  create(@Req() req: Request, @Body() body: CreateProjectDto) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.createProject(userId, body);
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getUserProjects(
      userId,
      page ? +page : undefined,
      pageSize ? +pageSize : undefined,
    );
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getProject(id, userId);
  }

  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { title?: string; coverImage?: string },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.updateProject(id, userId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.deleteProject(id, userId);
  }

  @Post(':id/clips')
  addClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: AddClipDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.addClip(projectId, userId, body);
  }

  @Put(':id/clips/:clipId')
  updateClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: UpdateClipDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.updateClip(projectId, clipId, userId, body);
  }

  @Delete(':id/clips/:clipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.deleteClip(projectId, clipId, userId);
  }

  @Put(':id/clips/reorder')
  reorderClips(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: { clipIds: string[] },
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.reorderClips(projectId, userId, body.clipIds);
  }

  @Post(':id/clips/:clipId/materials')
  addMaterial(
    @Req() req: Request,
    @Param('clipId') clipId: string,
    @Body() body: AddMaterialDto,
  ) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.addMaterial(clipId, userId, body);
  }

  @Delete(':id/materials/:materialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMaterial(
    @Req() req: Request,
    @Param('materialId') materialId: string,
  ) {
    const userId = (req.user as { userId: string }).userId;
    await this.projectService.removeMaterial(materialId, userId);
  }

  @Post(':id/clips/:clipId/generate')
  @Sse()
  generateClip(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() body: { variantLabel?: string; callbackUrl?: string },
  ): Observable<MessageEvent> {
    const userId = (req.user as { userId: string }).userId;
    const subject = new Subject<MessageEvent>();

    this.generationFlow
      .generateClip({
        clipId,
        projectId,
        userId,
        variantLabel: body.variantLabel,
        callbackUrl: body.callbackUrl,
      })
      .then((result) => {
        subject.next({ data: JSON.stringify({ type: 'generation_started', ...result }) } as MessageEvent);
        subject.complete();
      })
      .catch((err) => {
        subject.next({
          data: JSON.stringify({
            type: 'generation_error',
            error: err instanceof Error ? err.message : 'Unknown error',
          }),
        } as MessageEvent);
        subject.complete();
      });

    return subject.asObservable();
  }

  @Post(':id/generate')
  @Sse()
  generateAll(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: { callbackUrl?: string },
  ): Observable<MessageEvent> {
    const userId = (req.user as { userId: string }).userId;
    const subject = new Subject<MessageEvent>();

    this.generationFlow
      .generateAllClips(projectId, userId, body.callbackUrl)
      .then((result) => {
        subject.next({ data: JSON.stringify({ type: 'chain_started', ...result }) } as MessageEvent);
        subject.complete();
      })
      .catch((err) => {
        subject.next({
          data: JSON.stringify({
            type: 'generation_error',
            error: err instanceof Error ? err.message : 'Unknown error',
          }),
        } as MessageEvent);
        subject.complete();
      });

    return subject.asObservable();
  }

  @Get(':id/generations')
  getGenerations(@Req() req: Request, @Param('id') projectId: string) {
    const userId = (req.user as { userId: string }).userId;
    return this.projectService.getProjectGenerations(projectId, userId);
  }
}
