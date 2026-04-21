'use client';

import { ChevronDown, ChevronRight, FolderOpen, Plus, Edit, Trash } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@heroui/react';
import { AdminDrawerMeta } from '@/components/drawer-shell';
import { useTreeContext, MenuNode as MenuNodeType, PermissionNode as PermissionNodeType } from './tree-context';
import { PermissionNode } from './permission-node';

interface MenuNodeProps {
  menu: MenuNodeType;
  allMenus: MenuNodeType[];
  systemId?: string;
  onAddSubMenu?: (systemId: string, parentMenuId: string) => void;
  onEdit?: (menu: MenuNodeType) => void;
  onDelete?: (menuId: string) => void;
  onAddPermission?: (menuId: string) => void;
  onEditPermission?: (permission: PermissionNodeType) => void;
  onDeletePermission?: (permissionId: string) => void;
  level?: number;
}

export function MenuNode({
  menu,
  allMenus,
  systemId,
  onAddSubMenu,
  onEdit,
  onDelete,
  onAddPermission,
  onEditPermission,
  onDeletePermission,
  level = 0,
}: MenuNodeProps) {
  const { selectedNode, selectNode, expandedNodes, toggleExpanded } = useTreeContext();
  const isExpanded = expandedNodes.has(menu.id);
  const isSelected = selectedNode?.id === menu.id && selectedNode?.type === 'menu';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded(menu.id);
  };

  const handleSelect = () => {
    selectNode(menu.id, 'menu', menu);
  };

  const childMenus = allMenus.filter((m) => m.parentId === menu.id);
  const hasChildren = childMenus.length > 0 || menu.permissions.length > 0;

  // Only use a custom icon if it's a valid Lucide component (function), otherwise fall back to FolderOpen
  const customIcon = menu.icon ? (LucideIcons as any)[menu.icon] : null;
  const IconComponent = (typeof customIcon === 'function' ? customIcon : null) || FolderOpen;

  return (
    <div className="select-none">
      {/* Menu Header */}
      <div
        className={`group flex cursor-pointer items-center gap-2 border-b px-3 py-2.5 transition-colors ${
          isSelected ? 'bg-accent/8' : 'hover:bg-[color:var(--panel-muted)]'
        }`}
        style={{ paddingLeft: `${(level + 1) * 12 + 12}px`, borderColor: 'var(--border)' }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <button
            onClick={handleToggle}
            className="rounded p-0.5"
            style={{ color: isExpanded ? 'var(--accent)' : 'var(--muted)' }}
            title={isExpanded ? '折叠' : '展开'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-accent/70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-5 flex-shrink-0" />}

        <div className="flex h-5 w-5 items-center justify-center">
          <IconComponent className="h-3 w-3" style={{ color: 'var(--success)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{menu.name}</span>
            {!menu.visible && (
              <AdminDrawerMeta tone="default">隐藏</AdminDrawerMeta>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            <span className="font-mono">{menu.path || menu.code}</span>
            <span>•</span>
            <span>{menu.permissions.length} 权限</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddSubMenu && systemId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-accent hover:bg-accent/10"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubMenu(systemId, menu.id);
              }}
              aria-label="添加子菜单"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              子菜单
            </Button>
          )}
          {onAddPermission && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer hover:bg-muted"
              style={{ color: 'var(--accent)' }}
              onClick={(e) => {
                e.stopPropagation();
                onAddPermission(menu.id);
              }}
              aria-label="添加权限"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              权限
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(menu);
              }}
              aria-label="编辑菜单"
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
                onDelete(menu.id);
              }}
              aria-label="删除菜单"
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Child Menus and Permissions */}
      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {childMenus.map((childMenu) => (
            <MenuNode
              key={childMenu.id}
              menu={childMenu}
              allMenus={allMenus}
              systemId={systemId}
              onAddSubMenu={onAddSubMenu}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddPermission={onAddPermission}
              onEditPermission={onEditPermission}
              onDeletePermission={onDeletePermission}
              level={level + 1}
            />
          ))}

          {menu.permissions.map((permission) => (
            <PermissionNode
              key={permission.id}
              permission={permission}
              level={level + 1}
              onEdit={onEditPermission}
              onDelete={onDeletePermission}
            />
          ))}
        </div>
      )}
    </div>
  );
}
