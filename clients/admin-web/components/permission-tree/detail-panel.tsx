'use client';

import { Layers, Menu as MenuIcon, Key, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTreeContext } from './tree-context';

export function DetailPanel() {
  const { selectedNode } = useTreeContext();

  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Info className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">请选择一个节点</p>
        <p className="text-sm text-center">
          从左侧树状结构中选择系统、菜单或权限查看详情
        </p>
      </div>
    );
  }

  if (selectedNode.type === 'system') {
    const system = selectedNode.data as any;
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className="p-3 rounded-xl shadow-md"
              style={{ backgroundColor: 'var(--color-system)', color: 'oklch(99.11% 0 0)' }}
            >
              <Layers className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground mb-1 truncate">{system.name}</h2>
              <code
                className="text-xs text-muted-foreground px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                {system.code}
              </code>
            </div>
            <Badge
              variant="outline"
              className={system.status === 'ACTIVE' ? 'text-primary border-primary/30 bg-primary/10' : ''}
            >
              {system.status === 'ACTIVE' ? '启用' : '停用'}
            </Badge>
          </div>

          {/* Description */}
          {system.description && (
            <Card className="p-4 bg-muted/40 border-border">
              <p className="text-sm text-muted-foreground">{system.description}</p>
            </Card>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '菜单数量', value: system.menus.length },
              { label: '权限数量', value: system.menus.reduce((acc: number, menu: any) => acc + menu.permissions.length, 0) },
              { label: '排序', value: system.sort },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg border border-border bg-card">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-lg font-bold text-foreground mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Info */}
          <Card className="p-4 border-border bg-primary/5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">系统信息</p>
                <p className="text-muted-foreground text-xs font-mono">ID: {system.id}</p>
              </div>
            </div>
          </Card>
        </div>
      </ScrollArea>
    );
  }

  if (selectedNode.type === 'menu') {
    const menu = selectedNode.data as any;
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className="p-3 rounded-xl shadow-md"
              style={{ backgroundColor: 'var(--color-permission)', color: 'oklch(99.11% 0 0)' }}
            >
              <MenuIcon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground mb-1 truncate">{menu.name}</h2>
              <code
                className="text-xs text-muted-foreground px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                {menu.code}
              </code>
            </div>
            <Badge
              variant="outline"
              className={menu.visible ? 'text-primary border-primary/30 bg-primary/10' : ''}
            >
              {menu.visible ? '显示' : '隐藏'}
            </Badge>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '路由路径', value: menu.path || '/', mono: true },
              { label: '权限数量', value: menu.permissions.length },
              { label: '排序', value: menu.sort },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg border border-border bg-card">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className={`text-sm font-bold text-foreground truncate mt-0.5 ${item.mono ? 'font-mono text-xs' : 'text-lg'}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Permissions List */}
          {menu.permissions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">关联权限</h3>
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {menu.permissions.length} 个
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {menu.permissions.map((perm: any) => (
                  <div
                    key={perm.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <Key className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="flex-1 text-xs truncate text-foreground">{perm.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {perm.action}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0.5 ${
                        perm.type === 'FRONTEND'
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {perm.type === 'FRONTEND' ? '前端' : '后端'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  if (selectedNode.type === 'permission') {
    const permission = selectedNode.data as any;
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className="p-3 rounded-xl shadow-md"
              style={{ backgroundColor: 'var(--color-user)', color: 'oklch(99.11% 0 0)' }}
            >
              <Key className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground mb-1 truncate">{permission.name}</h2>
              <code
                className="text-xs text-muted-foreground px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                {permission.code}
              </code>
            </div>
          </div>

          {/* Description */}
          {permission.description && (
            <Card className="p-4 bg-muted/40 border-border">
              <p className="text-sm text-muted-foreground">{permission.description}</p>
            </Card>
          )}

          {/* Properties */}
          <div className="space-y-2">
            <Card className="p-3 border-border">
              <div className="text-xs text-muted-foreground mb-1.5">操作类型</div>
              <Badge variant="outline" className="text-xs">
                {permission.action}
              </Badge>
            </Card>
            <Card className="p-3 border-border">
              <div className="text-xs text-muted-foreground mb-1.5">权限类型</div>
              <Badge
                variant="outline"
                className={`text-xs ${
                  permission.type === 'FRONTEND'
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {permission.type === 'FRONTEND' ? '前端权限' : '后端权限'}
              </Badge>
            </Card>
          </div>

          {/* Info */}
          <Card className="p-4 border-border bg-primary/5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">权限说明</p>
                <p className="text-muted-foreground text-xs">
                  {permission.type === 'FRONTEND'
                    ? '控制前端UI元素的显示和隐藏'
                    : '控制后端API接口的访问权限'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </ScrollArea>
    );
  }

  return null;
}
