import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePermissionDto): Promise<any> {
    const existing = await this.prisma.permission.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('权限码已存在');
    return this.prisma.permission.create({ data: dto });
  }

  async findAll() {
    const permissions = await this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    // 按模块分组
    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return Object.entries(grouped).map(([module, permissions]) => ({ module, permissions }));
  }

  async findOne(id: string): Promise<any> {
    const p = await this.prisma.permission.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('权限不存在');
    return p;
  }

  async update(id: string, dto: UpdatePermissionDto): Promise<any> {
    await this.findOne(id);
    if (dto.code) {
      const existing = await this.prisma.permission.findFirst({ where: { code: dto.code, id: { not: id } } });
      if (existing) throw new ConflictException('权限码已存在');
    }
    return this.prisma.permission.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.permission.delete({ where: { id } });
    return { message: '删除成功' };
  }
}
