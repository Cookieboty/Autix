import { Injectable } from '@nestjs/common';
import {
  artifacts,
  artifact_versions,
  ArtifactType,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

export interface UpsertArtifactInput {
  conversationId: string;
  userId: string;
  title: string;
  type: ArtifactType;
  content: string;
  sourceMessageId?: string;
}

@Injectable()
export class ArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertArtifact(data: UpsertArtifactInput): Promise<artifacts> {
    const existing = await this.prisma.artifacts.findUnique({
      where: { conversationId: data.conversationId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (existing) {
      const newVersion = existing.currentVersion + 1;

      return this.prisma.$transaction(async (tx) => {
        const updatedArtifact = await tx.artifacts.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            content: data.content,
            currentVersion: newVersion,
            artifact_versions: {
              create: {
                version: newVersion,
                content: data.content,
                sourcetags: ['AI'],
                sourceMessageId: data.sourceMessageId,
              },
            },
          },
        });

        await tx.conversations.update({
          where: { id: data.conversationId },
          data: { title: data.title },
        });

        return updatedArtifact;
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const { sourceMessageId, ...artifactData } = data;

      const artifact = await tx.artifacts.create({
        data: {
          ...artifactData,
          currentVersion: 1,
          artifact_versions: {
            create: {
              version: 1,
              content: data.content,
              sourcetags: ['AI'],
              sourceMessageId,
            },
          },
        },
        include: { artifact_versions: true },
      });

      await tx.conversations.update({
        where: { id: data.conversationId },
        data: { title: data.title },
      });

      return artifact;
    });
  }

  findByIdWithConversation(artifactId: string) {
    return this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
      include: { conversations: true },
    });
  }

  updateTitleWithConversation(artifactId: string, conversationId: string, title: string) {
    return this.prisma.$transaction(async (tx) => {
      const updatedArtifact = await tx.artifacts.update({
        where: { id: artifactId },
        data: { title },
      });

      await tx.conversations.update({
        where: { id: conversationId },
        data: { title },
      });

      return updatedArtifact;
    });
  }

  findByIdWithLatestVersion(artifactId: string) {
    return this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
  }

  updateArtifactWithVersion(input: {
    artifactId: string;
    content: string;
    currentVersion: number;
    changelog?: string;
    sourcetags: string[];
  }) {
    return this.prisma.artifacts.update({
      where: { id: input.artifactId },
      data: {
        content: input.content,
        currentVersion: input.currentVersion,
        artifact_versions: {
          create: {
            version: input.currentVersion,
            content: input.content,
            changelog: input.changelog,
            sourcetags: input.sourcetags,
          },
        },
      },
    });
  }

  getVersions(artifactId: string): Promise<artifact_versions[]> {
    return this.prisma.artifact_versions.findMany({
      where: { artifactId },
      orderBy: { version: 'desc' },
    });
  }

  findVersion(artifactId: string, version: number) {
    return this.prisma.artifact_versions.findUniqueOrThrow({
      where: { artifactId_version: { artifactId, version } },
    });
  }

  findById(artifactId: string): Promise<artifacts> {
    return this.prisma.artifacts.findUniqueOrThrow({
      where: { id: artifactId },
    });
  }

  revertToVersion(input: {
    artifactId: string;
    currentVersion: number;
    content: string;
    targetVersion: number;
    sourcetags: string[];
  }): Promise<artifacts> {
    return this.prisma.artifacts.update({
      where: { id: input.artifactId },
      data: {
        content: input.content,
        currentVersion: input.currentVersion,
        artifact_versions: {
          create: {
            version: input.currentVersion,
            content: input.content,
            changelog: `恢复到版本 ${input.targetVersion}`,
            sourcetags: input.sourcetags,
          },
        },
      },
      include: { artifact_versions: true },
    });
  }

  findByConversation(conversationId: string): Promise<artifacts | null> {
    return this.prisma.artifacts.findUnique({
      where: { conversationId },
      include: {
        artifact_versions: {
          orderBy: { version: 'desc' },
          take: 10,
        },
      },
    });
  }

  async deleteArtifact(artifactId: string): Promise<void> {
    await this.prisma.artifacts.delete({
      where: { id: artifactId },
    });
  }

  findLatestStepArtifact(runId: string, stepKey: string) {
    return this.prisma.workflow_step_artifacts.findFirst({
      where: { runId, stepKey },
      orderBy: { version: 'desc' },
    });
  }
}
