'use client';

import { ChevronDown, ChevronRight, Layers, Plus, Edit, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../ui/button';
import { AdminDrawerMeta } from '../../admin-drawer-shell';
import { useTreeContext, SystemNode as SystemNodeType, MenuNode as MenuNodeType, PermissionNode as PermissionNodeType } from './tree-context';
import { MenuNode } from './menu-node';

interface SystemNodeProps {
  system: SystemNodeType;
  onEdit?: (system: SystemNodeType) => void;
  onDelete?: (id: string) => void;
  onAddMenu?: (systemId: string) => void;
  onAddSubMenu?: (systemId: string, parentMenuId: string) => void;
  onEditMenu?: (menu: MenuNodeType) => void;
  onDeleteMenu?: (menuId: string) => void;
  onAddPermission?: (menuId: string) => void;
  onEditPermission?: (permission: PermissionNodeType) => void;
  onDeletePermission?: (permissionId: string) => void;
}

export function SystemNode({
  system,
  onEdit,
  onDelete,
  onAddMenu,
  onAddSubMenu,
  onEditMenu,
  onDeleteMenu,
  onAddPermission,
  onEditPermission,
  onDeletePermission,
}: SystemNodeProps) {
  const t = useTranslations('permission');
  const { selectedNode, selectNode, expandedNodes, toggleExpanded } = useTreeContext();
  const isExpanded = expandedNodes.has(system.id);
  const isSelected = selectedNode?.id === system.id && selectedNode?.type === 'system';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded(system.id);
  };

  const handleSelect = () => {
    selectNode(system.id, 'system', system);
  };

  const totalPermissions = system.menus.reduce((acc, menu) => acc + menu.permissions.length, 0);

  return (
    <div className="select-none">
      {/* System Header */}
      <div
        className={`group flex cursor-pointer items-center gap-2 border-b px-3 py-3 transition-colors ${
          isSelected ? 'bg-accent/8' : 'hover:bg-[color:var(--panel-muted)]'
        }`}
        style={{ borderColor: 'var(--border)' }}
        onClick={handleSelect}
      >
        <button
          onClick={handleToggle}
          className="rounded p-0.5"
          style={{ color: isExpanded ? 'var(--brand)' : 'var(--muted)' }}
          title={isExpanded ? t('collapse') : t('expand')}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-accent/70" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          )}
        </button>

        <div className="flex h-6 w-6 items-center justify-center">
          <Layers className="h-3.5 w-3.5" style={{ color: 'var(--brand)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{system.name}</span>
            <AdminDrawerMeta tone={system.status === 'ACTIVE' ? 'success' : 'default'}>
              {system.status === 'ACTIVE' ? t('statusActive') : t('statusDisabled')}
            </AdminDrawerMeta>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            <span className="font-mono">{system.code}</span>
            <span>•</span>
            <span>{t('menuCountLabel', { count: system.menus.length })}</span>
            <span>•</span>
            <span>{t('permCountLabel', { count: totalPermissions })}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddMenu && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-accent hover:bg-accent/10"
              onClick={(e) => {
                e.stopPropagation();
                onAddMenu(system.id);
              }}
              aria-label={t('addMenu')}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(system);
              }}
              aria-label={t('editSystem')}
            >
              <Edit className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-danger hover:bg-danger/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(system.id);
              }}
              aria-label={t('deleteSystem')}
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Menus */}
      {isExpanded && system.menus.length > 0 && (
        <div className="ml-6 mt-1.5 space-y-1">
          {system.menus
            .filter((menu) => !menu.parentId)
            .map((menu) => (
              <MenuNode
                key={menu.id}
                menu={menu}
                allMenus={system.menus}
                systemId={system.id}
                onAddSubMenu={onAddSubMenu}
                onEdit={onEditMenu}
                onDelete={onDeleteMenu}
                onAddPermission={onAddPermission}
                onEditPermission={onEditPermission}
                onDeletePermission={onDeletePermission}
              />
            ))}
        </div>
      )}
    </div>
  );
}
