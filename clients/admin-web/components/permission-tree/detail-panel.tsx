'use client';

import { Layers, Menu as MenuIcon, Key, Info } from 'lucide-react';
import { AdminDrawerMeta } from '@/components/drawer-shell';
import { useTreeContext, type PermissionNode, type MenuNode, type SystemNode } from './tree-context';

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span
        className={`text-sm text-right ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: 'var(--foreground)' }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Info;
  title: string;
  count?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: 'var(--muted)' }} />
      <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        {title}
      </h3>
      {count}
    </div>
  );
}

export function DetailPanel() {
  const { selectedNode } = useTreeContext();

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center" style={{ color: 'var(--muted)' }}>
        <Info className="mb-4 h-14 w-14 opacity-30" />
        <p className="text-lg font-medium">请选择一个节点</p>
        <p className="mt-2 text-sm leading-6">从左侧树状结构中选择系统、菜单或权限查看详情。</p>
      </div>
    );
  }

  if (selectedNode.type === 'system') {
    const system = selectedNode.data as SystemNode;
    const permissionCount = system.menus.reduce((acc, menu) => acc + menu.permissions.length, 0);

    return (
      <div className="h-full overflow-auto px-6 py-6">
        <div className="space-y-6">
          <div className="border-b pb-5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                    {system.name}
                  </h2>
                </div>
                <code className="mt-3 inline-block text-xs" style={{ color: 'var(--muted)' }}>
                  {system.code}
                </code>
              </div>
              <AdminDrawerMeta tone={system.status === 'ACTIVE' ? 'success' : 'default'}>
                {system.status === 'ACTIVE' ? '启用' : '停用'}
              </AdminDrawerMeta>
            </div>
            {system.description && (
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {system.description}
              </p>
            )}
          </div>

          <div>
            <SectionTitle icon={Info} title="系统统计" />
            <div className="mt-3">
              <DetailRow label="菜单数量" value={system.menus.length} />
              <DetailRow label="权限数量" value={permissionCount} />
              <DetailRow label="排序" value={system.sort} />
            </div>
          </div>

          <div>
            <SectionTitle icon={Info} title="系统信息" />
            <div className="mt-3">
              <DetailRow label="系统 ID" value={system.id} mono />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedNode.type === 'menu') {
    const menu = selectedNode.data as MenuNode;

    return (
      <div className="h-full overflow-auto px-6 py-6">
        <div className="space-y-6">
          <div className="border-b pb-5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <MenuIcon className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                  <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                    {menu.name}
                  </h2>
                </div>
                <code className="mt-3 inline-block text-xs" style={{ color: 'var(--muted)' }}>
                  {menu.code}
                </code>
              </div>
              <AdminDrawerMeta tone={menu.visible ? 'success' : 'default'}>
                {menu.visible ? '显示' : '隐藏'}
              </AdminDrawerMeta>
            </div>
          </div>

          <div>
            <SectionTitle icon={Info} title="菜单属性" />
            <div className="mt-3">
              <DetailRow label="路由路径" value={menu.path || '/'} mono />
              <DetailRow label="权限数量" value={menu.permissions.length} />
              <DetailRow label="排序" value={menu.sort} />
            </div>
          </div>

          {menu.permissions.length > 0 && (
            <div>
              <SectionTitle
                icon={Key}
                title="关联权限"
                count={<AdminDrawerMeta tone="default">{menu.permissions.length}</AdminDrawerMeta>}
              />
              <div className="mt-3 divide-y" style={{ borderColor: 'var(--border)' }}>
                {menu.permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center gap-3 py-3">
                    <Key className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                    <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--foreground)' }}>
                      {perm.name}
                    </span>
                    <AdminDrawerMeta tone="default">{perm.action}</AdminDrawerMeta>
                    <AdminDrawerMeta tone={perm.type === 'FRONTEND' ? 'accent' : 'default'}>
                      {perm.type === 'FRONTEND' ? '前端' : '后端'}
                    </AdminDrawerMeta>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedNode.type === 'permission') {
    const permission = selectedNode.data as PermissionNode;

    return (
      <div className="h-full overflow-auto px-6 py-6">
        <div className="space-y-6">
          <div className="border-b pb-5" style={{ borderColor: 'var(--border)' }}>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--warning)' }} />
                <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {permission.name}
                </h2>
              </div>
              <code className="mt-3 inline-block text-xs" style={{ color: 'var(--muted)' }}>
                {permission.code}
              </code>
            </div>
            {permission.description && (
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {permission.description}
              </p>
            )}
          </div>

          <div>
            <SectionTitle icon={Info} title="权限属性" />
            <div className="mt-3">
              <DetailRow
                label="操作类型"
                value={<AdminDrawerMeta tone="default">{permission.action}</AdminDrawerMeta>}
              />
              <DetailRow
                label="权限类型"
                value={
                  <AdminDrawerMeta tone={permission.type === 'FRONTEND' ? 'accent' : 'default'}>
                    {permission.type === 'FRONTEND' ? '前端权限' : '后端权限'}
                  </AdminDrawerMeta>
                }
              />
            </div>
          </div>

          <div>
            <SectionTitle icon={Info} title="权限说明" />
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              {permission.type === 'FRONTEND'
                ? '控制前端 UI 元素的显示和隐藏。'
                : '控制后端 API 接口的访问权限。'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
