'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '../../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/select';
import { Users, Layers, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useAdminRolesBySystemQuery,
  useAdminSystemsQuery,
  useAdminUserSystemRolesQuery,
  useAuthStore,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useUpdateAdminUserSystemRolesMutation,
} from '@autix/shared-store';
import {
  AdminDrawerBody,
  AdminDrawerError,
  AdminDrawerFooter,
  AdminDrawerHero,
  AdminDrawerMeta,
  AdminDrawerSection,
  AdminDrawerShell,
  AdminField,
  AdminFieldGroup,
  adminInputClassName,
  adminInputStyle,
} from '../../admin-drawer-shell';

interface User {
  id: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING';
}

interface UserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSuccess: () => void;
}

interface UserForm {
  username: string;
  email: string;
  password?: string;
  realName?: string;
  phone?: string;
  status?: string;
  systemId?: string;
  roleCode?: string;
}

const selectTriggerClassName = adminInputClassName;

export function UserDrawer({ open, onOpenChange, user, onSuccess }: UserDrawerProps) {
  const t = useTranslations('users');
  const isEdit = !!user;
  const isSuperAdmin = useAuthStore((s) => s.user?.isSuperAdmin) ?? false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const createUserMutation = useCreateAdminUserMutation();
  const updateUserMutation = useUpdateAdminUserMutation();
  const updateUserSystemRolesMutation = useUpdateAdminUserSystemRolesMutation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserForm>();

  const status = watch('status');
  const systemId = watch('systemId');
  const roleCode = watch('roleCode');
  const { data: systems = [] } = useAdminSystemsQuery(open && isSuperAdmin);
  const {
    data: userSystemRoles = [],
    isLoading: rolesLoading,
    refetch: refetchUserSystemRoles,
  } = useAdminUserSystemRolesQuery(
    user?.id ?? '',
    open && isEdit && isSuperAdmin && Boolean(user),
  );
  const { data: rolesForSelectedSystem = [] } = useAdminRolesBySystemQuery(
    selectedSystemId,
    open && isSuperAdmin && Boolean(selectedSystemId),
  );
  const assignedSystemCount = userSystemRoles.length;
  const assignedRoleCount = userSystemRoles.reduce((count, group) => count + group.roles.length, 0);

  useEffect(() => {
    if (open) {
      if (user) {
        reset({
          username: user.username,
          email: user.email,
          realName: user.realName || '',
          phone: user.phone || '',
          status: user.status,
        });
      } else {
        reset({
          username: '',
          email: '',
          password: '',
          realName: '',
          phone: '',
          status: 'ACTIVE',
          systemId: '',
          roleCode: 'USER',
        });
      }
      setError('');
      setRolesPanelOpen(false);
      setSelectedSystemId('');
      setSelectedRoleId('');
    }
  }, [open, user, reset, isEdit, isSuperAdmin]);

  const handleAddRole = async () => {
    if (!user || !selectedSystemId || !selectedRoleId) return;
    try {
      const existing = userSystemRoles.map((group) => ({
        systemId: group.systemId,
        roleIds: group.roles.map((roleItem) => roleItem.id),
      }));
      const targetGroup = existing.find((group) => group.systemId === selectedSystemId);
      if (targetGroup) {
        if (!targetGroup.roleIds.includes(selectedRoleId)) {
          targetGroup.roleIds.push(selectedRoleId);
        }
      } else {
        existing.push({ systemId: selectedSystemId, roleIds: [selectedRoleId] });
      }
      await updateUserSystemRolesMutation.mutateAsync({
        id: user.id,
        data: { systemRoles: existing },
      });
      await refetchUserSystemRoles();
      setSelectedRoleId('');
    } catch (err: any) {
      setError(err.response?.data?.message || t('drawerRoleAddFailed'));
    }
  };

  const handleRemoveRole = async (sysId: string, roleId: string) => {
    if (!user) return;
    try {
      const existing = userSystemRoles.map((group) => ({
        systemId: group.systemId,
        roleIds: group.roles.map((roleItem) => roleItem.id).filter((id) => !(group.systemId === sysId && id === roleId)),
      })).filter((group) => group.roleIds.length > 0);
      await updateUserSystemRolesMutation.mutateAsync({
        id: user.id,
        data: { systemRoles: existing },
      });
      await refetchUserSystemRoles();
    } catch (err: any) {
      setError(err.response?.data?.message || t('drawerRoleRemoveFailed'));
    }
  };

  const onSubmit = async (data: UserForm) => {
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        const { password: _password, systemId: _s, roleCode: _r, ...updateData } = data;
        await updateUserMutation.mutateAsync({ id: user!.id, data: updateData });
      } else if (isSuperAdmin) {
        const { username, email, password, systemId: targetSystemId, roleCode: targetRoleCode } = data;
        await createUserMutation.mutateAsync({
          username,
          email,
          password,
          systemId: targetSystemId,
          roleCode: targetRoleCode,
        });
      } else {
        const { username, email, password } = data;
        await createUserMutation.mutateAsync({ username, email, password });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || t('drawerOperationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      width={isEdit ? 'md' : 'sm'}
      header={
        <AdminDrawerHero
          icon={<Users className="h-5 w-5" />}
          eyebrow={isEdit ? t('drawerEditEyebrow') : t('drawerCreateEyebrow')}
          title={isEdit ? user!.username : t('drawerCreateTitle')}
          description={isEdit ? t('drawerEditDescription') : t('drawerCreateDescription')}
          meta={
            isEdit ? (
              <AdminDrawerMeta tone={status === 'ACTIVE' ? 'success' : status === 'LOCKED' ? 'danger' : 'default'}>
                {status === 'ACTIVE' ? t('drawerStatusActive') : status === 'LOCKED' ? t('drawerStatusLocked') : status === 'DISABLED' ? t('drawerStatusDisabled') : t('drawerStatusPending')}
              </AdminDrawerMeta>
            ) : (
              <AdminDrawerMeta tone="default">{t('drawerNewMode')}</AdminDrawerMeta>
            )
          }
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? t('drawerEditAside') : t('drawerCreateAside')}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {loading ? t('drawerSaving') : isEdit ? t('drawerSaveChanges') : t('drawerCreateUser')}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        {error && <AdminDrawerError>{error}</AdminDrawerError>}

        {!isEdit && isSuperAdmin && (
          <AdminDrawerSection title={t('drawerBelongSection')} description={t('drawerBelongDescription')}>
            <AdminFieldGroup columns={2}>
              <AdminField label={t('drawerBelongSystem')} required>
                <Select
                  value={systemId || ''}
                  onValueChange={(val) => setValue('systemId', val)}
                >
                  <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {systems.map((sys) => (
                      <SelectItem key={sys.id} value={sys.id}>
                        {sys.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AdminField>

              <AdminField label={t('drawerRole')} required>
                <Select
                  value={roleCode || 'USER'}
                  onValueChange={(val) => setValue('roleCode', val)}
                >
                  <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_ADMIN">{t('drawerRoleAdmin')}</SelectItem>
                    <SelectItem value="USER">{t('drawerRoleUser')}</SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
            </AdminFieldGroup>
          </AdminDrawerSection>
        )}

        <AdminDrawerSection
          title={t('drawerAccountInfo')}
          description={isEdit ? t('drawerAccountEditDesc') : t('drawerAccountCreateDesc')}
        >
          <AdminField
            label={t('drawerUsername')}
            required
            error={errors.username?.message}
            help={isEdit ? t('drawerUsernameReadonly') : undefined}
          >
            <input
              {...register('username', {
                required: t('drawerUsernameRequired'),
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message: t('drawerUsernamePattern'),
                },
              })}
              disabled={isEdit}
              placeholder={t('drawerUsernamePlaceholder')}
              className={`${adminInputClassName} font-mono`}
              style={adminInputStyle}
              aria-invalid={!!errors.username}
            />
          </AdminField>

          <AdminField label={t('drawerEmail')} required error={errors.email?.message}>
            <input
              type="email"
              {...register('email', {
                required: t('drawerEmailRequired'),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t('drawerEmailInvalid'),
                },
              })}
              placeholder={t('drawerEmailPlaceholder')}
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.email}
            />
          </AdminField>

          {!isEdit && (
            <AdminField label={t('drawerPassword')} required error={errors.password?.message}>
              <input
                type="password"
                {...register('password', {
                  required: t('drawerPasswordRequired'),
                  minLength: { value: 6, message: t('drawerPasswordMinLength') },
                })}
                placeholder={t('drawerPasswordPlaceholder')}
                className={adminInputClassName}
                style={adminInputStyle}
                aria-invalid={!!errors.password}
              />
            </AdminField>
          )}
        </AdminDrawerSection>

        {isEdit && (
          <AdminDrawerSection title={t('drawerProfileSection')} description={t('drawerProfileDescription')}>
            <AdminFieldGroup columns={2}>
              <AdminField label={t('drawerRealName')}>
                <input
                  {...register('realName')}
                  placeholder={t('drawerRealNamePlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                />
              </AdminField>

              <AdminField label={t('drawerPhone')} error={errors.phone?.message}>
                <input
                  {...register('phone', {
                    pattern: {
                      value: /^1[3-9]\d{9}$/,
                      message: t('drawerPhoneInvalid'),
                    },
                  })}
                  placeholder={t('drawerPhonePlaceholder')}
                  className={adminInputClassName}
                  style={adminInputStyle}
                  aria-invalid={!!errors.phone}
                />
              </AdminField>
            </AdminFieldGroup>
          </AdminDrawerSection>
        )}

        {isEdit && (
          <AdminDrawerSection title={t('drawerStatusSection')} description={t('drawerStatusDescription')}>
            <AdminFieldGroup template="minmax(0,1fr) 180px">
              <AdminField label={t('drawerStatusLabel')}>
                <Select
                  value={status || 'ACTIVE'}
                  onValueChange={(val) => setValue('status', val)}
                >
                  <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                        {t('drawerStatusActiveItem')}
                      </div>
                    </SelectItem>
                    <SelectItem value="DISABLED">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                        {t('drawerStatusDisabledItem')}
                      </div>
                    </SelectItem>
                    <SelectItem value="LOCKED">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--danger)' }} />
                        {t('drawerStatusLockedItem')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
            </AdminFieldGroup>
          </AdminDrawerSection>
        )}

        {isEdit && isSuperAdmin && (
          <AdminDrawerSection title={t('drawerRoleSection')} description={t('drawerRoleDescription')}>
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className="rounded-md border px-4 py-3"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--panel-muted)',
                  }}
                >
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('drawerAssignedSystems')}</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{assignedSystemCount}</p>
                </div>
                <div
                  className="rounded-md border px-4 py-3"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--panel-muted)',
                  }}
                >
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('drawerTotalRoles')}</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{assignedRoleCount}</p>
                </div>
              </div>

              <div
                className="overflow-hidden rounded-md border"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--panel)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setRolesPanelOpen((value) => !value)}
                  className="flex w-full items-center justify-between px-4 py-3 transition-colors"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--panel-muted) 72%, var(--panel))',
                    borderBottom: rolesPanelOpen ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    <Layers className="h-4 w-4" style={{ color: 'var(--brand)' }} />
                    {t('drawerCurrentAssignments')}
                  </div>
                  {rolesPanelOpen ? (
                    <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                  ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted)' }} />
                  )}
                </button>

                {rolesPanelOpen && (
                  <div className="space-y-5 px-4 py-4">
                    {rolesLoading ? (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('loading')}</p>
                    ) : userSystemRoles.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('drawerNoRoleAssignments')}</p>
                    ) : (
                      <div className="space-y-4">
                        {userSystemRoles.map((group) => (
                          <div key={group.systemId} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                {group.systemName}
                              </p>
                              <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('drawerRoleCount', { count: group.roles.length })}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.roles.map((roleItem) => (
                                <span
                                  key={roleItem.id}
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                                  style={{
                                    color: 'var(--brand)',
                                    backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--brand) 18%, var(--border))',
                                  }}
                                >
                                  {roleItem.name}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRole(group.systemId, roleItem.id)}
                                    className="transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('drawerAddRole')}</p>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Select
                          value={selectedSystemId || ''}
                          onValueChange={(val) => {
                            setSelectedSystemId(val);
                            setSelectedRoleId('');
                          }}
                        >
                          <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {systems.map((systemItem) => (
                              <SelectItem key={systemItem.id} value={systemItem.id}>
                                {systemItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={selectedRoleId || ''}
                          onValueChange={(val) => setSelectedRoleId(val)}
                          disabled={!selectedSystemId}
                        >
                          <SelectTrigger className={selectTriggerClassName} style={adminInputStyle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rolesForSelectedSystem.map((roleItem) => (
                              <SelectItem key={roleItem.id} value={roleItem.id}>
                                {roleItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-[88px] cursor-pointer px-3"
                          disabled={!selectedSystemId || !selectedRoleId}
                          onClick={handleAddRole}
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            {t('drawerAddBtn')}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AdminDrawerSection>
        )}
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
