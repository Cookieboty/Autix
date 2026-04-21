'use client';

import { useState } from 'react';
import { Search, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Input, Button } from '@heroui/react';
import { useTreeContext, SystemNode as SystemNodeType, MenuNode as MenuNodeType, PermissionNode as PermissionNodeType } from './tree-context';
import { SystemNode } from './system-node';

interface TreeViewProps {
  systems: SystemNodeType[];
  loading?: boolean;
  onRefresh?: () => void;
  onEditSystem?: (system: SystemNodeType) => void;
  onDeleteSystem?: (systemId: string) => void;
  onAddMenu?: (systemId: string) => void;
  onAddSubMenu?: (systemId: string, parentMenuId: string) => void;
  onEditMenu?: (menu: MenuNodeType) => void;
  onDeleteMenu?: (menuId: string) => void;
  onAddPermission?: (menuId: string) => void;
  onEditPermission?: (permission: PermissionNodeType) => void;
  onDeletePermission?: (permissionId: string) => void;
}

function TreeViewContent({
  systems,
  loading,
  onRefresh,
  onEditSystem,
  onDeleteSystem,
  onAddMenu,
  onAddSubMenu,
  onEditMenu,
  onDeleteMenu,
  onAddPermission,
  onEditPermission,
  onDeletePermission,
}: TreeViewProps) {
  const { searchQuery, setSearchQuery, expandAll, collapseAll } = useTreeContext();
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const handleToggleAll = () => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
    setIsAllExpanded(!isAllExpanded);
  };

  const filteredSystems = systems.filter((system) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    if (system.name.toLowerCase().includes(query) || system.code.toLowerCase().includes(query)) {
      return true;
    }

    return system.menus.some((menu) => {
      if (
        menu.name.toLowerCase().includes(query) ||
        menu.code.toLowerCase().includes(query) ||
        menu.path?.toLowerCase().includes(query)
      ) {
        return true;
      }

      return menu.permissions.some(
        (permission) =>
          permission.name.toLowerCase().includes(query) ||
          permission.code.toLowerCase().includes(query),
      );
    });
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 border-b" style={{ borderColor: 'var(--border)' }}>
            <Search
              className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: 'var(--muted)' }}
            />
            <Input
              placeholder="搜索系统、菜单或权限..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-0 bg-transparent pl-6 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleToggleAll}
              className="h-10 rounded-full px-4"
              style={{
                backgroundColor: 'var(--panel-muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              aria-label={isAllExpanded ? '全部折叠' : '全部展开'}
            >
              {isAllExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              onClick={onRefresh}
              isDisabled={loading}
              className="h-10 rounded-full px-4"
              style={{
                backgroundColor: 'var(--panel-muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              aria-label="刷新"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : filteredSystems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: 'var(--muted)' }}>
            <Search className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{searchQuery ? '未找到匹配的结果' : '暂无数据'}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredSystems.map((system) => (
              <SystemNode
                key={system.id}
                system={system}
                onEdit={onEditSystem}
                onDelete={onDeleteSystem}
                onAddMenu={onAddMenu}
                onAddSubMenu={onAddSubMenu}
                onEditMenu={onEditMenu}
                onDeleteMenu={onDeleteMenu}
                onAddPermission={onAddPermission}
                onEditPermission={onEditPermission}
                onDeletePermission={onDeletePermission}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TreeView(props: TreeViewProps) {
  return <TreeViewContent {...props} />;
}
