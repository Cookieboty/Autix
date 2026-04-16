'use client';

import { Key, Edit, Trash } from 'lucide-react';
import { Badge } from '@heroui/react';
import { Button } from '@heroui/react';
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
          ? 'bg-accent/10 ring-1 ring-accent/20'
          : 'hover:bg-surface-secondary'
      }`}
      style={{ paddingLeft: `${(level + 2) * 12 + 12}px` }}
      onClick={handleSelect}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded bg-warning/15">
        <Key className="h-2.5 w-2.5 text-warning" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground truncate">{permission.name}</span>
          <Badge
            color={permission.type === 'FRONTEND' ? 'accent' : 'default'}
            variant="soft"
            className="text-[10px] px-1.5 py-0.5"
          >
            {permission.type === 'FRONTEND' ? '前端' : '后端'}
          </Badge>
          <Badge variant="soft" className="text-[10px] px-1.5 py-0.5">
            {permission.action}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5">{permission.code}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 cursor-pointer hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(permission);
            }}
            aria-label="编辑权限"
          >
            <Edit className="h-2.5 w-2.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 cursor-pointer text-danger hover:bg-danger/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(permission.id);
            }}
            aria-label="删除权限"
          >
            <Trash className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
