import { Injectable } from '@nestjs/common';
import { RuntimeReq } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RuntimeDetectorRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDesktopMcp(ids: string[]) {
    return this.prisma.mcp_servers.findFirst({
      where: {
        id: { in: ids },
        runtimeRequirement: RuntimeReq.DESKTOP_ONLY,
      },
      select: { id: true, title: true },
    });
  }

  findDesktopSkill(ids: string[]) {
    return this.prisma.skills.findFirst({
      where: {
        id: { in: ids },
        runtimeRequirement: RuntimeReq.DESKTOP_ONLY,
      },
      select: { id: true, title: true },
    });
  }
}
