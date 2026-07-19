import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { Prisma } from '../../platform/prisma/generated';
import { CreateSystemDto } from './dto/create-system.dto';
import { UpdateSystemDto } from './dto/update-system.dto';
import { SystemRepository } from './system.repository';

type SystemModel = Prisma.SystemGetPayload<object>;
type UserSystemWithRoles = SystemModel & { roles: string[] };
type UserSystemsResult = Array<SystemModel | UserSystemWithRoles>;

@Injectable()
export class SystemService {
  constructor(private readonly systemRepository: SystemRepository) { }

  async create(dto: CreateSystemDto) {
    const existing = await this.systemRepository.findByCode(dto.code);

    if (existing) {
      throw new I18nHttpException(HttpStatus.CONFLICT, 'system.code_taken', { code: dto.code });
    }

    return this.systemRepository.create(dto);
  }

  async findAll() {
    return this.systemRepository.findAll();
  }

  async findOne(id: string) {
    const system = await this.systemRepository.findWithMenusAndRoles(id);

    if (!system) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'system.not_found', { id });
    }

    return system;
  }

  async findUserSystems(userId: string): Promise<UserSystemsResult> {
    const user = await this.systemRepository.findUserWithSystems(userId);

    if (!user) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'user.not_found');
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
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'system.not_found', { id });
    }

    return this.systemRepository.findMenus(id);
  }

  async update(id: string, dto: UpdateSystemDto) {
    const existing = await this.systemRepository.findById(id);

    if (!existing) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'system.not_found', { id });
    }

    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.systemRepository.findByCode(dto.code);
      if (codeExists) {
        throw new I18nHttpException(HttpStatus.CONFLICT, 'system.code_taken', { code: dto.code });
      }
    }

    return this.systemRepository.update(id, dto);
  }

  async remove(id: string) {
    const existing = await this.systemRepository.findById(id);

    if (!existing) {
      throw new I18nHttpException(HttpStatus.NOT_FOUND, 'system.not_found', { id });
    }

    return this.systemRepository.delete(id);
  }
}
