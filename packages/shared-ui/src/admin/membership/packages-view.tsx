'use client';

import { useState } from 'react';
import { Button, Input } from '../../ui';
import { formatCurrency } from '../../format';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAdminPointsPackagesQuery,
  useCreateAdminPointsPackageMutation,
  useUpdateAdminPointsPackageMutation,
  useDeleteAdminPointsPackageMutation,
  type PointsPackage,
} from '@autix/shared-store';

const EMPTY_PKG = {
  code: '',
  name: '',
  description: '',
  price: '',
  points: 0,
  validityDays: 180,
  showCommercialLicense: false,
  isActive: true,
  sort: 0,
};

export function PointsPackagesView() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const { data: packages = [], isLoading: loading } = useAdminPointsPackagesQuery();
  const createPackageMutation = useCreateAdminPointsPackageMutation();
  const updatePackageMutation = useUpdateAdminPointsPackageMutation();
  const deletePackageMutation = useDeleteAdminPointsPackageMutation();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: Record<string, unknown> } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const payload = {
        code: (modal.data.code as string) || null,
        name: modal.data.name as string,
        description: (modal.data.description as string) || null,
        price: modal.data.price as string,
        points: Number(modal.data.points),
        validityDays: Number(modal.data.validityDays ?? 180),
        showCommercialLicense: Boolean(modal.data.showCommercialLicense),
        isActive: modal.data.isActive as boolean,
        sort: Number(modal.data.sort ?? 0),
      };
      if (modal.mode === 'create') {
        await createPackageMutation.mutateAsync(payload);
      } else {
        await updatePackageMutation.mutateAsync({ id: modal.data.id as string, data: payload });
      }
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pkg: PointsPackage) => {
    await updatePackageMutation.mutateAsync({
      id: pkg.id,
      data: { isActive: !pkg.isActive },
    });
  };

  const handleDeletePackage = async (pkg: PointsPackage) => {
    if (!window.confirm(`${tCommon('confirmDelete')} ${pkg.name}?`)) return;
    await deletePackageMutation.mutateAsync(pkg.id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminPackages')}</h1>
        <span className="flex-1" />
        <Button size="sm" className="cursor-pointer" onClick={() => setModal({ mode: 'create', data: { ...EMPTY_PKG } })}>
          <Plus className="w-3.5 h-3.5 mr-1" />{t('addPackage')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : packages.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('packageName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('packagePrice')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('packagePoints')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('validityPeriod')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('packageCommercialLicense')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('status')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('sortOrder')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{pkg.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatCurrency(pkg.price)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{pkg.points}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{t('validityDaysValue', { days: pkg.validityDays ?? 180 })}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{pkg.showCommercialLicense ? t('shown') : t('notShown')}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium cursor-pointer"
                      style={{
                        backgroundColor: pkg.isActive !== false ? 'var(--success-soft)' : 'var(--muted-soft)',
                        color: pkg.isActive !== false ? 'var(--success)' : 'var(--muted)',
                      }}
                      onClick={() => handleToggle(pkg)}
                    >
                      {pkg.isActive !== false ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{pkg.sort ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setModal({ mode: 'edit', data: { ...pkg } })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="cursor-pointer"
                      disabled={deletePackageMutation.isPending}
                      onClick={() => handleDeletePackage(pkg)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--modal-backdrop)' }} onClick={() => setModal(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {modal.mode === 'create' ? t('addPackage') : t('editPackage')}
              </h3>
              <button className="cursor-pointer" onClick={() => setModal(null)}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Code</label>
                <Input value={(modal.data.code as string) ?? ''} onChange={(e) => setModal({ ...modal, data: { ...modal.data, code: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('name')}</label>
                <Input value={modal.data.name as string} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('description')}</label>
                <Input value={(modal.data.description as string) ?? ''} onChange={(e) => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('price')}</label>
                <Input value={modal.data.price as string} onChange={(e) => setModal({ ...modal, data: { ...modal.data, price: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('points')}</label>
                <Input type="number" value={String(modal.data.points)} onChange={(e) => setModal({ ...modal, data: { ...modal.data, points: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('validityDays')}</label>
                <Input type="number" value={String(modal.data.validityDays ?? 180)} onChange={(e) => setModal({ ...modal, data: { ...modal.data, validityDays: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('sortOrder')}</label>
                <Input type="number" value={String(modal.data.sort ?? 0)} onChange={(e) => setModal({ ...modal, data: { ...modal.data, sort: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modal.data.isActive !== false}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, isActive: e.target.checked } })}
                />
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('active')}</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(modal.data.showCommercialLicense)}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, showCommercialLicense: e.target.checked } })}
                />
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('showCommercialLicenseLabel')}</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm" className="cursor-pointer" disabled={saving} onClick={handleSave}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
