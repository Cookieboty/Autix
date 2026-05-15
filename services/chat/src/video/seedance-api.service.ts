import { Injectable, Logger } from '@nestjs/common';
import type {
  VideoMaterialRole,
  video_clip_materials,
} from '../prisma/generated';

const SEEDANCE_BASE_URL = 'https://ark.cn-beijing.volces.com';
const TASKS_ENDPOINT = '/api/v3/contents/generations/tasks';
const TASK_QUERY_ENDPOINT = '/api/v3/contents/generations/tasks';

export interface SeedanceContentItem {
  type: 'text' | 'image_url' | 'video_url' | 'audio_url';
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  audio_url?: { url: string };
  role?: string;
}

export interface SeedanceTaskRequest {
  model: string;
  content: SeedanceContentItem[];
  callback_url?: string;
  return_last_frame?: boolean;
  generate_audio?: boolean;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  watermark?: boolean;
}

export interface SeedanceTaskResponse {
  id: string;
}

export interface SeedanceTaskStatus {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'expired';
  video_url?: string;
  last_frame_url?: string;
  duration?: number;
  ratio?: string;
  error?: { message?: string };
  usage?: Record<string, unknown>;
}

const ROLE_MAP: Record<VideoMaterialRole, string> = {
  first_frame: 'first_frame',
  last_frame: 'last_frame',
  reference_image: 'reference_image',
  reference_video: 'reference_video',
  reference_audio: 'reference_audio',
};

@Injectable()
export class SeedanceApiService {
  private readonly logger = new Logger(SeedanceApiService.name);

  buildContent(
    materials: Pick<video_clip_materials, 'role' | 'url'>[],
    prompt?: string | null,
  ): SeedanceContentItem[] {
    const items: SeedanceContentItem[] = [];

    if (prompt) {
      items.push({ type: 'text', text: prompt });
    }

    for (const mat of materials) {
      const role = ROLE_MAP[mat.role];

      if (
        mat.role === 'first_frame' ||
        mat.role === 'last_frame' ||
        mat.role === 'reference_image'
      ) {
        items.push({
          type: 'image_url',
          image_url: { url: mat.url },
          role,
        });
      } else if (mat.role === 'reference_video') {
        items.push({
          type: 'video_url',
          video_url: { url: mat.url },
          role,
        });
      } else if (mat.role === 'reference_audio') {
        items.push({
          type: 'audio_url',
          audio_url: { url: mat.url },
          role,
        });
      }
    }

    return items;
  }

  async createTask(
    apiKey: string,
    request: SeedanceTaskRequest,
  ): Promise<SeedanceTaskResponse> {
    const url = `${SEEDANCE_BASE_URL}${TASKS_ENDPOINT}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(
        `Seedance createTask failed: ${response.status} ${text.slice(0, 500)}`,
      );
      throw new Error(
        `Seedance API ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as SeedanceTaskResponse;
  }

  async queryTask(
    apiKey: string,
    taskId: string,
  ): Promise<SeedanceTaskStatus> {
    const url = `${SEEDANCE_BASE_URL}${TASK_QUERY_ENDPOINT}/${taskId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Seedance query ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as SeedanceTaskStatus;
  }

  buildTaskRequest(opts: {
    model: string;
    content: SeedanceContentItem[];
    callbackUrl?: string;
    returnLastFrame?: boolean;
    generateAudio?: boolean;
    resolution?: string;
    ratio?: string;
    duration?: number;
    seed?: number;
    watermark?: boolean;
  }): SeedanceTaskRequest {
    const request: SeedanceTaskRequest = {
      model: opts.model,
      content: opts.content,
    };

    if (opts.callbackUrl) request.callback_url = opts.callbackUrl;
    if (opts.returnLastFrame) request.return_last_frame = true;
    if (opts.generateAudio !== undefined)
      request.generate_audio = opts.generateAudio;
    if (opts.resolution) request.resolution = opts.resolution;
    if (opts.ratio) request.ratio = opts.ratio;
    if (opts.duration !== undefined) request.duration = opts.duration;
    if (opts.seed !== undefined && opts.seed !== -1) request.seed = opts.seed;
    if (opts.watermark) request.watermark = true;

    return request;
  }
}
