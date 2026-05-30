'use client';

import { Layers, Menu as MenuIcon, Key, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdminDrawerMeta } from '../../admin-drawer-shell';
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
  const t = useTranslations('permission');
  const { selectedNode } = useTreeContext();

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center" style={{ color: 'var(--muted)' }}>
        <Info className="mb-4 h-14 w-14 opacity-30" />
        <p className="text-lg font-medium">{t('detailSelectNode')}</p>
        <p className="mt-2 text-sm leading-6">{t('detailSelectNodeHint')}</p>
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
                  <Layers className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                  <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                    {system.name}
                  </h2>
                </div>
                <code className="mt-3 inline-block text-xs" style={{ color: 'var(--muted)' }}>
                  {system.code}
                </code>
              </div>
              <AdminDrawerMeta tone={system.status === 'ACTIVE' ? 'success' : 'default'}>
                {system.status === 'ACTIVE' ? t('statusActive') : t('statusDisabled')}
              </AdminDrawerMeta>
            </div>
            {system.description && (
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {system.description}
              </p>
            )}
          </div>

          <div>
            <SectionTitle icon={Info} title={t('detailSystemStats')} />
            <div className="mt-3">
              <DetailRow label={t('detailMenuCount')} value={system.menus.length} />
              <DetailRow label={t('detailPermCount')} value={permissionCount} />
              <DetailRow label={t('detailSort')} value={system.sort} />
            </div>
          </div>

          <div>
            <SectionTitle icon={Info} title={t('detailSystemInfo')} />
            <div className="mt-3">
              <DetailRow label={t('detailSystemId')} value={system.id} mono />
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
                {menu.visible ? t('menuVisible') : t('menuHidden')}
              </AdminDrawerMeta>
            </div>
          </div>

          <div>
            <SectionTitle icon={Info} title={t('detailMenuProps')} />
            <div className="mt-3">
              <DetailRow label={t('detailRoutePath')} value={menu.path || '/'} mono />
              <DetailRow label={t('detailPermCount')} value={menu.permissions.length} />
              <DetailRow label={t('detailSort')} value={menu.sort} />
            </div>
          </div>

          {menu.permissions.length > 0 && (
            <div>
              <SectionTitle
                icon={Key}
                title={t('detailLinkedPerms')}
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
                      {perm.type === 'FRONTEND' ? t('frontend') : t('backend')}
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
            <SectionTitle icon={Info} title={t('detailPermProps')} />
            <div className="mt-3">
              <DetailRow
                label={t('detailActionType')}
                value={<AdminDrawerMeta tone="default">{permission.action}</AdminDrawerMeta>}
              />
              <DetailRow
                label={t('detailPermType')}
                value={
                  <AdminDrawerMeta tone={permission.type === 'FRONTEND' ? 'accent' : 'default'}>
                    {permission.type === 'FRONTEND' ? t('frontendPermission') : t('backendPermission')}
                  </AdminDrawerMeta>
                }
              />
            </div>
          </div>

          <div>
            <SectionTitle icon={Info} title={t('detailPermNote')} />
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              {permission.type === 'FRONTEND'
                ? t('detailFrontendNote')
                : t('detailBackendNote')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
