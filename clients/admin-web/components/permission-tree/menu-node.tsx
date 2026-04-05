'use client';

import { ChevronDown, ChevronRight, Menu as MenuIcon, Plus, Edit, Trash } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  // Get icon
  const IconComponent = (menu.icon && (LucideIcons as any)[menu.icon]) || MenuIcon;

  return (
    <div className="select-none">
      {/* Menu Header */}
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-gradient-to-r from-teal-50 to-green-50 ring-2 ring-teal-200 shadow-md'
            : 'hover:bg-gray-50 active:bg-gray-100'
        }`}
        style={{ paddingLeft: `${(level + 1) * 12 + 12}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <button onClick={handleToggle} className="p-0.5 hover:bg-gray-200 rounded" title={isExpanded ? '折叠' : '展开'}>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}

        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-green-500 shadow-sm">
          <IconComponent className="h-3 w-3 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900 truncate">{menu.name}</span>
            {!menu.visible && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                隐藏
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span className="font-mono">{menu.path || menu.code}</span>
            <span>•</span>
            <span>🔑 {menu.permissions.length}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddSubMenu && systemId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubMenu(systemId, menu.id);
              }}
              title="添加子菜单"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              子菜单
            </Button>
          )}
          {onAddPermission && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-purple-600 hover:bg-purple-50 hover:text-purple-700"
              onClick={(e) => {
                e.stopPropagation();
                onAddPermission(menu.id);
              }}
              title="添加权限"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              权限
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 cursor-pointer text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(menu);
              }}
              title="编辑菜单"
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
                onDelete(menu.id);
              }}
              title="删除菜单"
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Child Menus and Permissions */}
      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {/* Child Menus */}
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

          {/* Permissions */}
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
