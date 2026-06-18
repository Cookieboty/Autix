'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { Plus, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatCurrency, membershipAdminApi } from '@autix/shared-lib';

interface AdminPackage {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  price: string;
  points: number;
  validityDays?: number;
  showCommercialLicense?: boolean;
  isActive?: boolean;
  sort?: number;
}

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

export function SystemMembershipPackagesPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getPackages();
      const data = res.data as any;
      setPackages(Array.isArray(data) ? data : data?.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPackages(); }, []);

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const payload = {
        code: modal.data.code || null,
        name: modal.data.name,
        description: modal.data.description || null,
        price: modal.data.price,
        points: Number(modal.data.points),
        validityDays: Number(modal.data.validityDays ?? 180),
        showCommercialLicense: Boolean(modal.data.showCommercialLicense),
        isActive: modal.data.isActive,
        sort: Number(modal.data.sort ?? 0),
      };
      if (modal.mode === 'create') {
        await membershipAdminApi.createPackage(payload);
      } else {
        await membershipAdminApi.updatePackage(modal.data.id, payload);
      }
      setModal(null);
      fetchPackages();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pkg: AdminPackage) => {
    await membershipAdminApi.updatePackage(pkg.id, { isActive: !pkg.isActive });
    fetchPackages();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminPackages')}</h1>
        <span className="flex-1" />
        <Button size="sm"  className="cursor-pointer" onClick={() => setModal({ mode: 'create', data: { ...EMPTY_PKG } })}>
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
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>有效期</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>商用说明</th>
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
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{pkg.validityDays ?? 180} 天</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{pkg.showCommercialLicense ? '显示' : '不显示'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium cursor-pointer"
                      style={{
                        backgroundColor: pkg.isActive !== false ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
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
                {modal.mode === 'create' ? t('addPackage') : t('editPackage')}
              </h3>
              <button className="cursor-pointer" onClick={() => setModal(null)}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Code</label>
                <Input value={modal.data.code ?? ''} onChange={(e) => setModal({ ...modal, data: { ...modal.data, code: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('name')}</label>
                <Input value={modal.data.name} onChange={(e) => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>说明</label>
                <Input value={modal.data.description ?? ''} onChange={(e) => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('price')}</label>
                <Input value={modal.data.price} onChange={(e) => setModal({ ...modal, data: { ...modal.data, price: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('points')}</label>
                <Input type="number" value={String(modal.data.points)} onChange={(e) => setModal({ ...modal, data: { ...modal.data, points: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>有效期天数</label>
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
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>显示商用授权说明</label>
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
