import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionType, Prisma } from '../../platform/prisma/generated';
import type { MessageResponse } from '@autix/domain';
import { PermissionRepository } from './permission.repository';

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepository: PermissionRepository) { }

  async create(dto: CreatePermissionDto) {
    const existing = await this.permissionRepository.findByCode(dto.code);
    if (existing) throw new I18nHttpException(HttpStatus.CONFLICT, 'permission.code_taken');
    return this.permissionRepository.create(dto);
  }

  async findAll(systemId?: string, menuId?: string, type?: string) {
    const where: Prisma.PermissionWhereInput = {};

    if (menuId) {
      where.menuId = menuId;
    } else if (systemId) {
      where.menu = { systemId };
    }

    if (type) {
      where.type = type as PermissionType;
    }

    return this.permissionRepository.findMany(where);
  }

  async findOne(id: string) {
    const p = await this.permissionRepository.findById(id);
    if (!p) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'permission.not_found');
    return p;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    await this.findOne(id);
    if (dto.code) {
      const existing = await this.permissionRepository.findCodeConflict(id, dto.code);
      if (existing) throw new I18nHttpException(HttpStatus.CONFLICT, 'permission.code_taken');
    }
    return this.permissionRepository.update(id, dto);
  }

  async remove(id: string): Promise<MessageResponse> {
    await this.findOne(id);
    await this.permissionRepository.delete(id);
    return { messageKey: 'common.deleted' };
  }
}
