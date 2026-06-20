import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import { SystemRepository } from './system.repository';

type SystemModel = Prisma.SystemGetPayload<object>;
type UserSystemWithRoles = SystemModel & { roles: string[] };
type UserSystemsResult = Array<SystemModel | UserSystemWithRoles>;

@Injectable()
export class SystemService {
  constructor(private readonly systemRepository: SystemRepository) {}

  async create(dto: CreateSystemDto) {
    const existing = await this.systemRepository.findByCode(dto.code);

    if (existing) {
      throw new ConflictException(`System with code ${dto.code} already exists`);
    }

    return this.systemRepository.create(dto);
  }

  async findAll() {
    return this.systemRepository.findAll();
  }

  async findOne(id: string) {
    const system = await this.systemRepository.findWithMenusAndRoles(id);

    if (!system) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    return system;
  }

  async findUserSystems(userId: string): Promise<UserSystemsResult> {
    const user = await this.systemRepository.findUserWithSystems(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isSuperAdmin) {
      return this.findAll();
    }

    const systemMap = new Map<string, UserSystemWithRoles>();
    user.roles.forEach((userRole) => {
      const system = userRole.role.system;
      if (system && !systemMap.has(system.id)) {
        systemMap.set(system.id, {
          ...system,
          roles: [],
        });
      }
      if (system) {
        systemMap.get(system.id)?.roles.push(userRole.role.code);
      }
    });

    return Array.from(systemMap.values());
  }

  async getSystemMenus(id: string) {
    const system = await this.systemRepository.findById(id);

    if (!system) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    return this.systemRepository.findMenus(id);
  }

  async update(id: string, dto: UpdateSystemDto) {
    const existing = await this.systemRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.systemRepository.findByCode(dto.code);
      if (codeExists) {
        throw new ConflictException(`System with code ${dto.code} already exists`);
      }
    }

    return this.systemRepository.update(id, dto);
  }

  async remove(id: string) {
    const existing = await this.systemRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(`System with ID ${id} not found`);
    }

    return this.systemRepository.delete(id);
  }
}
