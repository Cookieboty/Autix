'use client';

import { Key, Edit, Trash } from 'lucide-react';
import { Button } from '@heroui/react';
import { AdminDrawerMeta } from '@/components/drawer-shell';
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
      className={`group flex cursor-pointer items-center gap-2 border-b px-3 py-2 transition-colors ${
        isSelected ? 'bg-accent/8' : 'hover:bg-[color:var(--panel-muted)]'
      }`}
      style={{ paddingLeft: `${(level + 2) * 12 + 12}px`, borderColor: 'var(--border)' }}
      onClick={handleSelect}
    >
      <div className="flex h-4 w-4 items-center justify-center">
        <Key className="h-2.5 w-2.5" style={{ color: 'var(--warning)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs" style={{ color: 'var(--foreground)' }}>{permission.name}</span>
          <AdminDrawerMeta tone={permission.type === 'FRONTEND' ? 'accent' : 'default'}>
            {permission.type === 'FRONTEND' ? '前端' : '后端'}
          </AdminDrawerMeta>
          <AdminDrawerMeta tone="default">{permission.action}</AdminDrawerMeta>
        </div>
        <div className="mt-0.5 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{permission.code}</div>
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
