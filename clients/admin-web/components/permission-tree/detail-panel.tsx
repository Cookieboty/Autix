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
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
        <Info className="h-16 w-16 mb-4 opacity-50" />
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
        <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{system.name}</h2>
            <code className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {system.code}
            </code>
          </div>
          <Badge
            variant="outline"
            className={`${
              system.status === 'ACTIVE'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {system.status === 'ACTIVE' ? '启用' : '停用'}
          </Badge>
        </div>

        {/* Description */}
        {system.description && (
          <Card className="p-4 bg-gray-50">
            <p className="text-sm text-gray-600">{system.description}</p>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">菜单数量</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{system.menus.length}</div>
          </div>
          <div className="p-2 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">权限数量</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {system.menus.reduce((acc: number, menu: any) => acc + menu.permissions.length, 0)}
            </div>
          </div>
          <div className="p-2 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">排序</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{system.sort}</div>
          </div>
        </div>

        {/* Info */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">系统信息</p>
              <p>ID: {system.id}</p>
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
        <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
            <MenuIcon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{menu.name}</h2>
            <code className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {menu.code}
            </code>
          </div>
          <Badge
            variant="outline"
            className={menu.visible ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}
          >
            {menu.visible ? '显示' : '隐藏'}
          </Badge>
        </div>

        {/* Statistics - Compact Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">路由路径</div>
            <div className="text-sm font-mono text-gray-900 truncate mt-0.5">{menu.path || '/'}</div>
          </div>
          <div className="p-2 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">权限数量</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{menu.permissions.length}</div>
          </div>
          <div className="p-2 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">排序</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{menu.sort}</div>
          </div>
        </div>

        {/* Permissions List - Expanded Space */}
        {menu.permissions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-700">关联权限</h3>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {menu.permissions.length} 个
              </Badge>
            </div>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {menu.permissions.map((perm: any) => (
                <div key={perm.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                  <Key className="h-3 w-3 text-blue-600 flex-shrink-0" />
                  <span className="flex-1 text-xs truncate">{perm.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                    {perm.action}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0.5 ${
                      perm.type === 'FRONTEND'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-green-50 text-green-700 border-green-200'
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
        <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
            <Key className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{permission.name}</h2>
            <code className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {permission.code}
            </code>
          </div>
        </div>

        {/* Description */}
        {permission.description && (
          <Card className="p-4 bg-gray-50">
            <p className="text-sm text-gray-600">{permission.description}</p>
          </Card>
        )}

        {/* Properties */}
        <div className="space-y-2">
          <Card className="p-3">
            <div className="text-xs text-gray-500 mb-1.5">操作类型</div>
            <Badge variant="outline" className="text-xs">
              {permission.action}
            </Badge>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500 mb-1.5">权限类型</div>
            <Badge
              variant="outline"
              className={`text-xs ${
                permission.type === 'FRONTEND'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              {permission.type === 'FRONTEND' ? '前端权限' : '后端权限'}
            </Badge>
          </Card>
        </div>

        {/* Info */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">权限说明</p>
              <p>{permission.type === 'FRONTEND' ? '控制前端UI元素的显示和隐藏' : '控制后端API接口的访问权限'}</p>
            </div>
          </div>
        </Card>
        </div>
      </ScrollArea>
    );
  }

  return null;
}
