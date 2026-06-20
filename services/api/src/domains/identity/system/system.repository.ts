import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';

@Injectable()
export class SystemRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string) {
    return this.prisma.system.findUnique({
      where: { code },
    });
  }

  create(dto: CreateSystemDto) {
    return this.prisma.system.create({
      data: dto,
    });
  }

  findAll() {
    return this.prisma.system.findMany({
      orderBy: { sort: 'asc' },
    });
  }

  findWithMenusAndRoles(id: string) {
    return this.prisma.system.findUnique({
      where: { id },
      include: {
        menus: {
          where: { parentId: null },
          orderBy: { sort: 'asc' },
        },
        roles: {
          orderBy: { sort: 'asc' },
        },
      },
    });
  }

  findUserWithSystems(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                system: true,
              },
            },
          },
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.system.findUnique({
      where: { id },
    });
  }

  findMenus(id: string) {
    return this.prisma.menu.findMany({
      where: { systemId: id },
      orderBy: { sort: 'asc' },
      include: {
        children: {
          orderBy: { sort: 'asc' },
        },
      },
    });
  }

  update(id: string, dto: UpdateSystemDto) {
    return this.prisma.system.update({
      where: { id },
      data: dto,
    });
  }

  delete(id: string) {
    return this.prisma.system.delete({
      where: { id },
    });
  }
}
