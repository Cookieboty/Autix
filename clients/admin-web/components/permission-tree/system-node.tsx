'use client';

import { ChevronDown, ChevronRight, Layers, Plus, Edit, Trash } from 'lucide-react';
import { Badge } from '@heroui/react';
import { Button } from '@heroui/react';
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
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-accent/10 ring-1 ring-accent/20'
            : 'hover:bg-surface-secondary'
        }`}
        onClick={handleSelect}
      >
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-muted rounded"
          title={isExpanded ? '折叠' : '展开'}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-accent/70" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          )}
        </button>

        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/15">
          <Layers className="h-3.5 w-3.5 text-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base text-foreground truncate">{system.name}</span>
            <Badge
              color={system.status === 'ACTIVE' ? 'success' : 'default'}
              variant="soft"
              className="text-xs px-2 py-0.5"
            >
              {system.status === 'ACTIVE' ? '启用' : '停用'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{system.code}</span>
            <span className="flex items-center gap-1">
              <span>📋 {system.menus.length} 菜单</span>
              <span>•</span>
              <span>🔑 {totalPermissions} 权限</span>
            </span>
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
              aria-label="添加菜单"
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
              aria-label="编辑系统"
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
              aria-label="删除系统"
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
