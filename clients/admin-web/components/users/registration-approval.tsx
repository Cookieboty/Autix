'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface Registration {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string;
  createdAt: string;
  processedAt?: string;
  user: { id: string; username: string; email: string; realName?: string };
  system: { id: string; name: string; code: string };
  processedBy?: { id: string; username: string };
}

type ActionType = 'approve' | 'reject' | null;

export function RegistrationApproval() {
  const queryClient = useQueryClient();
  const [actionTarget, setActionTarget] = useState<{ id: string; type: ActionType } | null>(null);
  const [note, setNote] = useState('');

  const { data: registrations = [], isLoading, refetch } = useQuery<Registration[]>({
    queryKey: ['registrations', 'PENDING'],
    queryFn: async () => {
      const { data } = await api.get('/registrations?status=PENDING');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.put(`/registrations/${id}/approve`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeDialog();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.put(`/registrations/${id}/reject`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeDialog();
    },
  });

  const closeDialog = () => {
    setActionTarget(null);
    setNote('');
  };

  const handleConfirm = () => {
    if (!actionTarget) return;
    if (actionTarget.type === 'approve') {
      approveMutation.mutate({ id: actionTarget.id, note });
    } else {
      rejectMutation.mutate({ id: actionTarget.id, note });
    }
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <Button variant="ghost" onClick={() => refetch()} className="cursor-pointer">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>申请系统</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                  暂无待审批申请
                </TableCell>
              </TableRow>
            ) : (
              registrations.map((reg) => (
                <TableRow key={reg.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium font-mono">{reg.user.username}</TableCell>
                  <TableCell>{reg.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{reg.system.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(reg.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionTarget({ id: reg.id, type: 'approve' })}
                        className="h-8 px-2 cursor-pointer hover:bg-green-50 hover:text-green-600"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        通过
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionTarget({ id: reg.id, type: 'reject' })}
                        className="h-8 px-2 cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        拒绝
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.type === 'approve' ? '审批通过确认' : '拒绝确认'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              备注（可选）
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                actionTarget?.type === 'reject' ? '请填写拒绝原因...' : '审批备注...'
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="cursor-pointer">
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className={`cursor-pointer ${
                actionTarget?.type === 'approve'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isPending ? '处理中...' : actionTarget?.type === 'approve' ? '确认通过' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
