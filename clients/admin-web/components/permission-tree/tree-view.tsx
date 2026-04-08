'use client';

import { useState } from 'react';
import { Search, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const { searchQuery, setSearchQuery, expandAll, collapseAll, expandedNodes } = useTreeContext();
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const handleToggleAll = () => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
    setIsAllExpanded(!isAllExpanded);
  };

  // Filter systems based on search query
  const filteredSystems = systems.filter((system) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Check system name or code
    if (
      system.name.toLowerCase().includes(query) ||
      system.code.toLowerCase().includes(query)
    ) {
      return true;
    }

    // Check menus
    const hasMatchingMenu = system.menus.some((menu) => {
      if (
        menu.name.toLowerCase().includes(query) ||
        menu.code.toLowerCase().includes(query) ||
        menu.path?.toLowerCase().includes(query)
      ) {
        return true;
      }

      // Check permissions
      return menu.permissions.some((permission) =>
        permission.name.toLowerCase().includes(query) ||
        permission.code.toLowerCase().includes(query)
      );
    });

    return hasMatchingMenu;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索系统、菜单或权限..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={handleToggleAll}
            title={isAllExpanded ? '全部折叠' : '全部展开'}
          >
            {isAllExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={onRefresh}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                加载中...
              </div>
            ) : filteredSystems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mb-2" />
                <p>
                  {searchQuery ? '未找到匹配的结果' : '暂无数据'}
                </p>
              </div>
            ) : (
              filteredSystems.map((system) => (
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
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export function TreeView(props: TreeViewProps) {
  return <TreeViewContent {...props} />;
}
