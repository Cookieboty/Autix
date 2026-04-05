'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  code: string;
  action: string;
  module: string;
  description?: string;
}

interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

const MODULE_LABELS: Record<string, string> = {
  user: '用户管理',
  role: '角色管理',
  permission: '权限管理',
  department: '部门管理',
  menu: '菜单管理',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  READ: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
  EXPORT: 'bg-purple-100 text-purple-700',
  IMPORT: 'bg-indigo-100 text-indigo-700',
};

export default function PermissionsPage() {
  const { data: groups = [], isLoading, refetch } = useQuery<PermissionGroup[]>({
    queryKey: ['permissions-grouped'],
    queryFn: async () => {
      const { data } = await api.get('/permissions');
      return data;
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-mono" style={{ color: '#7C3AED' }}>
          权限管理
        </h1>
        <Button variant="ghost" onClick={() => refetch()} className="cursor-pointer">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.module} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-4 w-4" style={{ color: '#7C3AED' }} />
                  {MODULE_LABELS[group.module] || group.module}
                  <Badge variant="secondary" className="ml-auto">
                    {group.permissions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium font-mono text-gray-700">{perm.code}</p>
                        {perm.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{perm.description}</p>
                        )}
                      </div>
                      <Badge
                        className={`${ACTION_COLORS[perm.action] || 'bg-gray-100 text-gray-600'} border-0 ml-2`}
                      >
                        {perm.action}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
