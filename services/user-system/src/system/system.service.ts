import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSystemDto): Promise<any> {
    const existing = await this.prisma.system.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`System with code ${dto.code} already exists`);
    }

    return this.prisma.system.create({
      data: dto,
    });
  }

  async findAll(): Promise<any> {
    return this.prisma.system.findMany({
      orderBy: { sort: 'asc' },
    });
  }

  async findOne(id: string): Promise<any> {
    const system = await this.prisma.system.findUnique({
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

    if (!system) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    return system;
  }

  async findUserSystems(userId: string) {
    const user = await this.prisma.user.findUnique({
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

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isSuperAdmin) {
      return this.findAll();
    }

    const systemMap = new Map();
    user.roles.forEach((userRole) => {
      const system = userRole.role.system;
      if (system && !systemMap.has(system.id)) {
        systemMap.set(system.id, {
          ...system,
          roles: [],
        });
      }
      if (system) {
        systemMap.get(system.id).roles.push(userRole.role.code);
      }
    });

    return Array.from(systemMap.values());
  }

  async getSystemMenus(id: string) {
    const system = await this.prisma.system.findUnique({
      where: { id },
    });

    if (!system) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

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

  async update(id: string, dto: UpdateSystemDto): Promise<any> {
    const existing = await this.prisma.system.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.prisma.system.findUnique({
        where: { code: dto.code },
      });
      if (codeExists) {
        throw new ConflictException(`System with code ${dto.code} already exists`);
      }
    }

    return this.prisma.system.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string): Promise<any> {
    const existing = await this.prisma.system.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    return this.prisma.system.delete({
      where: { id },
    });
  }
}
