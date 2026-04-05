import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('部门编码已存在');
    return this.prisma.department.create({ data: dto });
  }

  async findAll() {
    const all = await this.prisma.department.findMany({
      orderBy: { sort: 'asc' },
    });
    return this.buildTree(all);
  }

  private buildTree(items: any[], parentId: string | null = null): any[] {
    return items
      .filter((i) => i.parentId === parentId)
      .map((i) => ({ ...i, children: this.buildTree(items, i.id) }));
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('部门不存在');
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    if (dto.code) {
      const existing = await this.prisma.department.findFirst({
        where: { code: dto.code, id: { not: id } },
      });
      if (existing) throw new ConflictException('部门编码已存在');
    }
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const hasChildren = await this.prisma.department.findFirst({ where: { parentId: id } });
    if (hasChildren) throw new ConflictException('请先删除子部门');
    const hasUsers = await this.prisma.user.findFirst({ where: { departmentId: id } });
    if (hasUsers) throw new ConflictException('部门下还有用户，无法删除');
    await this.prisma.department.delete({ where: { id } });
    return { message: '删除成功' };
  }
}
