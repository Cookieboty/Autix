'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { useGenerationTaskAdminDetail } from '@autix/shared-store';
import {
  AdminDrawerShell,
  AdminDrawerBody,
  AdminDrawerSection,
  AdminDrawerError,
} from '../../admin-drawer-shell';

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs">
        {value === null || value === undefined ? '—' : String(value)}
      </span>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function GenerationTaskDetailDrawer({ taskId, open, onOpenChange }: Props) {
  const t = useTranslations('adminOperations');
  // enabled 门控：抽屉没打开就不发请求（照 admin/users/user-drawer.tsx 的既有写法）。
  const { data, isLoading, isError } = useGenerationTaskAdminDetail(taskId, open);

  return (
    <AdminDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      width="xl"
      header={<div className="font-semibold">{t('generationTasks.drawer.title')}</div>}
    >
      <AdminDrawerBody>
        {isError ? (
          <AdminDrawerError>{t('common.loadFailed')}</AdminDrawerError>
        ) : isLoading || !data ? (
          <div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <>
            <AdminDrawerSection title={t('generationTasks.drawer.basic')}>
              <Field label="id" value={data.task.id} />
              <Field label="kind" value={data.task.kind} />
              <Field label="status" value={data.task.status} />
              <Field label="userId" value={data.task.userId} />
              <Field label="model" value={data.task.model} />
              <Field label="provider" value={data.task.provider} />
              <Field label="protocolKey" value={data.task.protocolKey} />
              <Field label="providerTaskId" value={data.task.providerTaskId} />
              <Field label="createdAt" value={data.task.createdAt} />
              <Field label="submittedAt" value={data.task.submittedAt} />
              <Field label="queuedAt" value={data.task.queuedAt} />
              <Field label="finishedAt" value={data.task.finishedAt} />
              <Field label="durationMs" value={data.task.durationMs} />
              <Field label="lateCallbackAt" value={data.task.lateCallbackAt} />
              <Field label="lateOutcome" value={data.task.lateOutcome} />
            </AdminDrawerSection>

            <AdminDrawerSection title={t('generationTasks.drawer.failure')}>
              <Field label="errorStage" value={data.task.errorStage} />
              <Field label="errorClass" value={data.task.errorClass} />
              <Field label="errorCode" value={data.task.errorCode} />
              <Field label="errorMessage" value={data.task.errorMessage} />
              <Field label="upstreamStatus" value={data.task.upstreamStatus} />
              <Field label="upstreamRequestId" value={data.task.upstreamRequestId} />
              <div className="pt-2 text-sm text-muted-foreground">upstreamBody</div>
              <JsonBlock value={data.task.upstreamBody} />
              <div className="pt-2 text-sm text-muted-foreground">upstreamDiagnostics</div>
              <JsonBlock value={data.task.upstreamDiagnostics} />
            </AdminDrawerSection>

            <AdminDrawerSection title={t('generationTasks.drawer.promptSection')}>
              {/* 明确标注敏感：让查看者意识到这是用户隐私内容，而不是普通调试字段。 */}
              <p className="pb-2 text-xs text-amber-600">
                {t('generationTasks.drawer.promptSensitiveHint')}
              </p>
              <JsonBlock value={data.task.prompt} />
            </AdminDrawerSection>

            <AdminDrawerSection title={t('generationTasks.drawer.snapshot')}>
              <JsonBlock value={data.task.paramsSnapshot} />
            </AdminDrawerSection>

            <AdminDrawerSection title={t('generationTasks.drawer.billing')}>
              {data.dataInconsistent ? (
                // 显眼的脏数据标记：billingStatus=CONFIRMED 但查不到对应 hold 行。
                // 客服凭此判断，避免对同一笔任务重复退款或重复扣费。
                <div
                  className="mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-5"
                  style={{
                    color: 'var(--warning)',
                    backgroundColor: 'var(--panel)',
                    border: '1px solid var(--warning)',
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>{t('generationTasks.drawer.dataInconsistentWarning')}</span>
                </div>
              ) : null}
              <Field label="billingStatus" value={data.task.billingStatus} />
              <Field label="billingError" value={data.task.billingError} />
              <Field label="pointsCost" value={data.task.pointsCost} />
              <Field label="holdId" value={data.task.holdId} />
              <Field label="hold.status" value={data.hold?.status} />
              <Field label="hold.estimatedAmount" value={data.hold?.estimatedAmount} />
              <Field label="hold.confirmedAmount" value={data.hold?.confirmedAmount} />
              {data.pointsRecords.map((r) => (
                <Field key={r.id} label={r.source} value={`${r.amount} @ ${r.createdAt}`} />
              ))}
            </AdminDrawerSection>

            <AdminDrawerSection title={t('generationTasks.drawer.links')}>
              <Field label="videoGenerationId" value={data.task.videoGenerationId} />
              <Field label="imageGenerationId" value={data.task.imageGenerationId} />
            </AdminDrawerSection>
          </>
        )}
      </AdminDrawerBody>
    </AdminDrawerShell>
  );
}
