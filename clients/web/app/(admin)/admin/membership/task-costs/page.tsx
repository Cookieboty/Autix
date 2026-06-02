'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { Plus, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { membershipAdminApi } from '@/lib/api';

interface AdminTaskCost {
  id: string;
  taskType: string;
  name: string;
  cost: number;
  isActive?: boolean;
}

const EMPTY_COST = { taskType: '', name: '', cost: 0, isActive: true };

export default function AdminTaskCostsPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [costs, setCosts] = useState<AdminTaskCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getTaskCosts();
      const data = res.data as any;
      setCosts(Array.isArray(data) ? data : data?.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCosts(); }, []);

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const payload = {
        taskType: modal.data.taskType,
        name: modal.data.name,
        cost: Number(modal.data.cost),
        isActive: modal.data.isActive,
      };
      if (modal.mode === 'create') {
        await membershipAdminApi.createTaskCost(payload);
      } else {
        await membershipAdminApi.updateTaskCost(modal.data.id, payload);
      }
      setModal(null);
      fetchCosts();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminTaskCosts')}</h1>
        <span className="flex-1" />
        <Button size="sm"  className="cursor-pointer" onClick={() => setModal({ mode: 'create', data: { ...EMPTY_COST } })}>
          <Plus className="w-3.5 h-3.5 mr-1" />{t('addTaskCost')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : costs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('taskType')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('name')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('taskCost')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{c.taskType}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{c.cost}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: c.isActive !== false ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                        color: c.isActive !== false ? 'var(--success)' : 'var(--muted)',
                      }}
                    >
                      {c.isActive !== false ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setModal({ mode: 'edit', data: { ...c } })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setModal(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {modal.mode === 'create' ? t('addTaskCost') : t('editTaskCost')}
              </h3>
              <button className="cursor-pointer" onClick={() => setModal(null)}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('taskType')}</label>
                <Input value={modal.data.taskType} onChange={(e) => setModal({ ...modal, data: { ...modal.data, taskType: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('name')}</label>
                <Input value={modal.data.name} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('cost')}</label>
                <Input type="number" value={String(modal.data.cost)} onChange={(e) => setModal({ ...modal, data: { ...modal.data, cost: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modal.data.isActive !== false}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, isActive: e.target.checked } })}
                />
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('active')}</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm"  className="cursor-pointer" disabled={saving} onClick={handleSave}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
