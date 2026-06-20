import { Injectable } from '@nestjs/common';
import { VideoGenStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class RiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  countActiveVideoGenerations(userId: string, statuses: VideoGenStatus[]) {
    return this.prisma.video_clip_generations.count({
      where: {
        userId,
        status: { in: statuses },
      },
    });
  }
}
