'use client';

import { ChevronDown, ChevronRight, Layers, Plus, Edit, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
            ? 'bg-gradient-to-r from-cyan-50 to-blue-50 ring-2 ring-cyan-200 shadow-md'
            : 'hover:bg-gray-50 active:bg-gray-100'
        }`}
        onClick={handleSelect}
      >
        <button onClick={handleToggle} className="p-0.5 hover:bg-gray-200 rounded" title={isExpanded ? '折叠' : '展开'}>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
          )}
        </button>

        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 shadow-sm">
          <Layers className="h-3.5 w-3.5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base text-gray-900 truncate">{system.name}</span>
            <Badge
              variant={system.status === 'ACTIVE' ? 'default' : 'secondary'}
              className="text-xs px-2 py-0.5"
            >
              {system.status === 'ACTIVE' ? '启用' : '停用'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
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
              className="h-7 px-2 cursor-pointer text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={(e) => {
                e.stopPropagation();
                onAddMenu(system.id);
              }}
              title="添加菜单"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(system);
              }}
              title="编辑系统"
            >
              <Edit className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(system.id);
              }}
              title="删除系统"
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
