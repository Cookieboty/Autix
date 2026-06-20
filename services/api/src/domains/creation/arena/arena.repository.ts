import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class ArenaRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(userId: string, title?: string, selectedModelIds?: string[]) {
    return this.prisma.arena_sessions.create({
      data: { userId, title: title || '新对比', selectedModelIds: selectedModelIds ?? [] },
    });
  }

  findSession(id: string) {
    return this.prisma.arena_sessions.findUnique({ where: { id } });
  }

  updateSelectedModels(id: string, modelIds: string[]) {
    return this.prisma.arena_sessions.update({
      where: { id },
      data: { selectedModelIds: modelIds },
    });
  }

  findSessions(userId: string) {
    return this.prisma.arena_sessions.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findSessionDetail(id: string) {
    return this.prisma.arena_sessions.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { createdAt: 'asc' },
          include: {
            responses: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
  }

  deleteSession(id: string) {
    return this.prisma.arena_sessions.delete({ where: { id } });
  }

  clearTurns(sessionId: string) {
    return this.prisma.arena_turns.deleteMany({ where: { sessionId } });
  }

  async createTurnWithResponses(
    sessionId: string,
    userMessage: string,
    modelIds: string[],
    images?: string[],
  ) {
    const turn = await this.prisma.arena_turns.create({
      data: {
        sessionId,
        userMessage,
        images: images ?? [],
        responses: {
          create: modelIds.map((modelConfigId) => ({
            modelConfigId,
            status: 'pending',
          })),
        },
      },
      include: { responses: true },
    });

    await this.prisma.arena_sessions.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return turn;
  }

  findTurnsForHistory(sessionId: string) {
    return this.prisma.arena_turns.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      include: {
        responses: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
  }

  updateResponse(
    responseId: string,
    data: Prisma.arena_responsesUncheckedUpdateInput,
  ) {
    return this.prisma.arena_responses.update({
      where: { id: responseId },
      data,
    });
  }
}
