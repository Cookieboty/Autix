'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Building, Edit, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { DepartmentDrawer } from '@/components/departments/department-drawer';

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string | null;
  sort: number;
  createdAt: string;
}

export default function DepartmentsPage() {
  const { hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const canCreate = hasPermission('department:create');
  const canUpdate = hasPermission('department:update');
  const canDelete = hasPermission('department:delete');

  const { data: departments = [], isLoading, refetch } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get('/departments');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/departments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.patch(`/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setDrawerOpen(true);
  };

  const handleSubmit = async (data: any) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个部门吗？')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const buildDepartmentTree = (items: Department[]) => {
    const map = new Map<string, Department & { children: Department[] }>();
    const roots: (Department & { children: Department[] })[] = [];

    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parentId) {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const deptTree = buildDepartmentTree(departments);

  const renderDepartmentRow = (dept: Department & { children?: Department[] }, level = 0) => {
    const rows = [];
    rows.push(
      <TableRow key={dept.id}>
        <TableCell>
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
            {level > 0 && <span className="text-gray-400">└─</span>}
            <span className="font-medium">{dept.name}</span>
          </div>
        </TableCell>
        <TableCell>
          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{dept.code}</code>
        </TableCell>
        <TableCell className="text-gray-600 max-w-xs truncate">
          {dept.description || '-'}
        </TableCell>
        <TableCell>{dept.sort}</TableCell>
        <TableCell className="text-gray-500 text-sm">
          {new Date(dept.createdAt).toLocaleDateString('zh-CN')}
        </TableCell>
        {(canUpdate || canDelete) && (
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              {canUpdate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(dept)}
                  className="h-8 px-2 cursor-pointer hover:bg-blue-50 hover:text-blue-600"
                  title="编辑"
                >
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  编辑
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(dept.id)}
                  className="h-8 px-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
                  title="删除"
                >
                  <Trash className="h-3.5 w-3.5 mr-1" />
                  删除
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
    );

    if (dept.children && dept.children.length > 0) {
      dept.children.forEach((child) => {
        rows.push(...renderDepartmentRow(child, level + 1));
      });
    }

    return rows;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-mono" style={{ color: '#7C3AED' }}>
            部门管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理组织架构和部门层级</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button
              onClick={openCreate}
              className="cursor-pointer gap-2"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <Plus className="h-4 w-4" />
              新增部门
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>部门名称</TableHead>
              <TableHead>部门编码</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>创建时间</TableHead>
              {(canUpdate || canDelete) && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Building className="h-8 w-8" />
                    <span>暂无部门数据</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              deptTree.flatMap((dept) => renderDepartmentRow(dept))
            )}
          </TableBody>
        </Table>
      </div>

      <DepartmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        initialData={editing ? { ...editing, parentId: editing.parentId || undefined } : undefined}
        isEdit={!!editing}
        departments={departments}
      />
    </div>
  );
}
