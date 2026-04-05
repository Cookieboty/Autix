'use client';

import { Key, Edit, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTreeContext, PermissionNode as PermissionNodeType } from './tree-context';

interface PermissionNodeProps {
  permission: PermissionNodeType;
  level: number;
  onEdit?: (permission: PermissionNodeType) => void;
  onDelete?: (permissionId: string) => void;
}

export function PermissionNode({ permission, level, onEdit, onDelete }: PermissionNodeProps) {
  const { selectedNode, selectNode } = useTreeContext();
  const isSelected = selectedNode?.id === permission.id && selectedNode?.type === 'permission';

  const handleSelect = () => {
    selectNode(permission.id, 'permission', permission);
  };

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 ring-2 ring-blue-200 shadow-md'
          : 'hover:bg-gray-50 active:bg-gray-100'
      }`}
      style={{ paddingLeft: `${(level + 2) * 12 + 12}px` }}
      onClick={handleSelect}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-indigo-500 shadow-sm">
        <Key className="h-2.5 w-2.5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-900 truncate">{permission.name}</span>
          <Badge
            variant={permission.type === 'FRONTEND' ? 'default' : 'secondary'}
            className="text-[10px] px-1.5 py-0.5"
          >
            {permission.type === 'FRONTEND' ? '前端' : '后端'}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0.5"
          >
            {permission.action}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 font-mono mt-0.5">{permission.code}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 cursor-pointer text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(permission);
            }}
            title="编辑权限"
          >
            <Edit className="h-2.5 w-2.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(permission.id);
            }}
            title="删除权限"
          >
            <Trash className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
