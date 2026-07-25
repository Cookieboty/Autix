import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { Prisma } from '../../platform/prisma/generated';
import type { MessageResponse } from '@autix/domain';
import { RoleRepository } from './role.repository';

type RoleWithPermissions = NonNullable<
  Awaited<ReturnType<RoleService['findOne']>>
>;
type RolePermissionLink = RoleWithPermissions['permissions'][number];
type RoleWithMenus = NonNullable<
  Awaited<ReturnType<RoleService['findRoleWithMenus']>>
>;
type RoleMenuLink = RoleWithMenus['menus'][number];

@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) { }

  async create(dto: CreateRoleDto) {
    const existing = await this.roleRepository.findBySystemAndCode(dto.systemId, dto.code);
    if (existing) throw new I18nHttpException(HttpStatus.CONFLICT, 'role.code_taken');
    return this.roleRepository.create(dto);
  }

  async findAll(systemId?: string) {
    const where: Prisma.RoleWhereInput = systemId ? { systemId } : {};
    return this.roleRepository.findMany(where);
  }

  async findOne(id: string) {
    const role = await this.roleRepository.findWithPermissions(id);
    if (!role) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'role.not_found');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    if (dto.name || dto.code) {
      const existing = await this.roleRepository.findNameOrCodeConflict(id, dto);
      if (existing) throw new I18nHttpException(HttpStatus.CONFLICT, 'role.name_or_code_taken');
    }
    return this.roleRepository.update(id, dto);
  }

  async remove(id: string): Promise<MessageResponse> {
    const role = await this.findOne(id);
    if (role._count.users > 0) throw new I18nHttpException(HttpStatus.CONFLICT, 'role.has_users');
    await this.roleRepository.delete(id);
    return { messageKey: 'common.deleted' };
  }

  async getPermissions(id: string) {
    const role = await this.findOne(id);
    return role.permissions.map((rp: RolePermissionLink) => rp.permission);
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto): Promise<MessageResponse> {
    await this.findOne(id);
    await this.roleRepository.replacePermissions(id, dto.permissionIds);
    return { messageKey: 'role.permissions_assigned' };
  }

  async assignMenusAndPermissions(
    id: string,
    menuIds: string[],
    permissionIds: string[],
  ): Promise<MessageResponse> {
    await this.findOne(id);

    // 使用事务同时更新菜单和权限关联
    await this.roleRepository.replaceMenusAndPermissions(id, menuIds, permissionIds);

    return { messageKey: 'role.menus_permissions_assigned' };
  }

  private async findRoleWithMenus(id: string) {
    const role = await this.roleRepository.findWithMenus(id);
    if (!role) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'role.not_found');
    return role;
  }

  async getMenus(id: string) {
    const role = await this.findRoleWithMenus(id);
    return role.menus.map((rm: RoleMenuLink) => rm.menu);
  }

  async assignMenus(id: string, menuIds: string[]): Promise<MessageResponse> {
    await this.findOne(id);
    await this.roleRepository.replaceMenus(id, menuIds);
    return { messageKey: 'role.menus_assigned' };
  }
}
