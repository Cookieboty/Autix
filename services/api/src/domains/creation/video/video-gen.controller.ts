import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import type { AuthUser } from '@autix/domain';
import { VIDEO_MATERIAL_ROLES, type VideoMaterialRole } from '@autix/domain/video';
import { VideoDirectGenerationService, type DirectVideoMaterialInput } from './video-direct-generation.service';
import { VideoGenerationRepository } from './video-generation.repository';
import { VideoChatService } from './video-chat.service';
import { toDirectVideoGenerationDto } from './video-direct-generation.presenter';
import { GalleryService } from '../gallery/gallery.service';

const MAX_PAGE_SIZE = 60;

/** HTTP body 里的原始素材形状——role 未经校验，是 string 而非 VideoMaterialRole。 */
interface RawDirectVideoMaterialInput {
  role: string;
  url: string;
  sourceType?: string;
  name?: string | null;
}

const VALID_MATERIAL_ROLES: readonly string[] = VIDEO_MATERIAL_ROLES;

@UseGuards(JwtAuthGuard)
@Controller('video-gen')
export class VideoGenController {
  constructor(
    private readonly directService: VideoDirectGenerationService,
    private readonly repository: VideoGenerationRepository,
    private readonly videoChatService: VideoChatService,
    private readonly galleryService: GalleryService,
  ) {}

  @Post('generate')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() body: { prompt: string; params?: Record<string, unknown>; materials?: RawDirectVideoMaterialInput[] },
  ) {
    const userId = getCurrentUserId(user);
    if (!body.prompt?.trim()) throw new BadRequestException('请输入提示词');
    const materials = this.validateMaterials(body.materials ?? []);
    return this.directService.generate({ userId, prompt: body.prompt, materials, clientParams: body.params ?? {} });
  }

  @Get('history')
  async history(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const userId = getCurrentUserId(user);
    const rawPage = page ? +page : 1;
    const p = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
    const rawPs = pageSize ? +pageSize : 20;
    const ps = Number.isFinite(rawPs) ? Math.min(MAX_PAGE_SIZE, Math.max(1, rawPs)) : 20;
    const { generations, total } = await this.repository.findUserDirectGenerations({ userId, page: p, pageSize: ps });
    // 整页一次批量取活帖（与 image workbench history 同做法），避免逐条查的 N+1。
    // 无活帖的生成记录不附 galleryPost 字段，前端据此判定「未发布」。
    const posts = await this.galleryService.findActivePostsByVideoGenerationIds(
      userId,
      generations.map((generation) => generation.id),
    );
    const items = generations.map((generation) => {
      const dto = toDirectVideoGenerationDto(generation);
      const post = posts.get(generation.id);
      return post ? { ...dto, galleryPost: post } : dto;
    });
    return { items, total, page: p, pageSize: ps, hasMore: (p - 1) * ps + generations.length < total };
  }

  @Get('generations/:id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    const gen = await this.repository.findOwnedDirectGeneration({ id, userId });
    if (!gen) throw new BadRequestException('记录不存在');
    return toDirectVideoGenerationDto(gen);
  }

  @Delete('history/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const userId = getCurrentUserId(user);
    const r = await this.repository.deleteOwnedDirectGeneration({ id, userId });
    if (r === 'not_found') throw new BadRequestException('记录不存在');
    if (r === 'not_terminal') throw new ConflictException('任务进行中，无法删除');
  }

  @Post('optimize-prompt')
  async optimizePrompt(@CurrentUser() user: AuthUser, @Body() body: { prompt: string; modelId?: string }) {
    const userId = getCurrentUserId(user);
    if (!body.prompt?.trim()) throw new BadRequestException('请输入提示词');
    return this.videoChatService.optimizePrompt({ userId, prompt: body.prompt.trim(), modelConfigId: body.modelId, billingPurpose: 'video_template_optimize' });
  }

  /**
   * body 里的 materials 来自 HTTP，role 只是 string——不能直接强转成
   * `DirectVideoMaterialInput`（其 role 是 VideoMaterialRole 联合类型）。
   * 逐条按运行时白名单 VIDEO_MATERIAL_ROLES 校验，非法角色一律 400。
   */
  private validateMaterials(materials: RawDirectVideoMaterialInput[]): DirectVideoMaterialInput[] {
    return materials.map((m) => {
      if (!VALID_MATERIAL_ROLES.includes(m.role)) {
        throw new BadRequestException(`无效的素材角色: ${m.role}`);
      }
      if (!m.url?.trim()) throw new BadRequestException('素材缺少 url');
      return {
        role: m.role as VideoMaterialRole,
        url: m.url,
        sourceType: m.sourceType,
        name: m.name,
      };
    });
  }
}
