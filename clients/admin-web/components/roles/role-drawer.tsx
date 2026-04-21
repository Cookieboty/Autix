'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@heroui/react';
import { Shield } from 'lucide-react';
import api from '@/lib/api';
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
} from '@/components/drawer-shell';

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  sort: number;
}

interface RoleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onSuccess: () => void;
}

interface RoleForm {
  name: string;
  code: string;
  description?: string;
  sort?: number;
}

export function RoleDrawer({ open, onOpenChange, role, onSuccess }: RoleDrawerProps) {
  const isEdit = !!role;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleForm>();

  useEffect(() => {
    if (open) {
      reset(
        role
          ? { name: role.name, code: role.code, description: role.description || '', sort: role.sort }
          : { name: '', code: '', description: '', sort: 0 }
      );
      setError('');
    }
  }, [open, role, reset]);

  const onSubmit = async (data: RoleForm) => {
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.patch(`/roles/${role!.id}`, data);
      } else {
        await api.post('/roles', data);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      width="sm"
      header={
        <AdminDrawerHero
          icon={<Shield className="h-5 w-5" />}
          eyebrow={isEdit ? '编辑角色' : '新建角色'}
          title={isEdit ? role!.name : '创建新角色'}
          description={isEdit ? '修改角色的基本信息与描述。' : '定义一个新的系统角色，可在下一步继续分配权限。'}
          meta={<AdminDrawerMeta tone={isEdit ? 'accent' : 'default'}>{isEdit ? '编辑模式' : '新建模式'}</AdminDrawerMeta>}
        />
      }
      footer={
        <AdminDrawerFooter
          aside={isEdit ? '修改后会立即影响该角色的展示信息。' : '创建后可继续进入权限分配。'}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[88px] cursor-pointer text-sm font-medium"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit(onSubmit)}
                {...({ isLoading: loading } as any)}
                className="min-w-[120px] cursor-pointer text-sm font-medium shadow-sm"
              >
                {loading ? '保存中...' : isEdit ? '保存修改' : '创建角色'}
              </Button>
            </>
          }
        />
      }
    >
      <AdminDrawerBody>
        {error && <AdminDrawerError>{error}</AdminDrawerError>}

        <AdminDrawerSection title="基本信息" description="定义角色的名称、编码与职责说明。">
          <AdminField
            label="角色名称"
            required
            error={errors.name?.message}
          >
            <input
              {...register('name', { required: '请输入角色名称' })}
              placeholder="如：系统管理员"
              className={adminInputClassName}
              style={adminInputStyle}
              aria-invalid={!!errors.name}
            />
          </AdminField>

          <AdminFieldGroup template="minmax(0,1fr) 144px">
            <AdminField
              label="角色编码"
              required
              error={errors.code?.message}
              help={
                isEdit
                  ? '角色编码创建后不可修改'
                  : '建议使用简洁稳定的英文编码。'
              }
            >
              <input
                {...register('code', { required: '请输入角色编码' })}
                disabled={isEdit}
                placeholder="如：ADMIN"
                className={`${adminInputClassName} font-mono`}
                style={adminInputStyle}
                aria-invalid={!!errors.code}
              />
            </AdminField>

            <AdminField label="排序" help="数值越小越靠前">
              <input
                type="number"
                {...register('sort', { valueAsNumber: true })}
                defaultValue={0}
                className={adminInputClassName}
                style={adminInputStyle}
              />
            </AdminField>
          </AdminFieldGroup>

          <AdminField label="描述">
            <input
              {...register('description')}
              placeholder="简要描述该角色的职责"
              className={adminInputClassName}
              style={adminInputStyle}
            />
          </AdminField>
        </AdminDrawerSection>
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
