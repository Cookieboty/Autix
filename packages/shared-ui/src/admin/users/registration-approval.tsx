'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { userApi as api } from '@autix/shared-lib';

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
  const t = useTranslations('users');
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

      <div className="rounded-lg border bg-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('approvalUsername')}</TableHead>
              <TableHead>{t('approvalEmail')}</TableHead>
              <TableHead>{t('approvalApplySystem')}</TableHead>
              <TableHead>{t('approvalRegisterTime')}</TableHead>
              <TableHead className="text-right">{t('approvalActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('approvalNoApprovals')}
                </TableCell>
              </TableRow>
            ) : (
              registrations.map((reg) => (
                <TableRow key={reg.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium font-mono">{reg.user.username}</TableCell>
                  <TableCell>{reg.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{reg.system.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(reg.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionTarget({ id: reg.id, type: 'approve' })}
                        className="h-8 px-2 cursor-pointer hover:bg-success/10 hover:text-success"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {t('approvalApprove')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionTarget({ id: reg.id, type: 'reject' })}
                        className="h-8 px-2 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {t('approvalReject')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!actionTarget}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
      >
        <DialogContent>
          <DialogHeader>
            {actionTarget?.type === 'approve' ? t('approvalApproveConfirm') : t('approvalRejectConfirm')}
          </DialogHeader>
          <DialogBody>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              {t('approvalNoteOptional')}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                actionTarget?.type === 'reject' ? t('approvalRejectPlaceholder') : t('approvalApprovePlaceholder')
              }
              className="min-h-[80px]"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="cursor-pointer">
              {t('cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              variant={actionTarget?.type === 'approve' ? 'default' : 'destructive'}
              className="cursor-pointer"
            >
              {isPending ? t('approvalProcessing') : actionTarget?.type === 'approve' ? t('approvalConfirmApprove') : t('approvalConfirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
