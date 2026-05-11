'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { Plus, Pencil, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { membershipAdminApi, type MembershipLevel, type MembershipPlan } from '@autix/shared-lib';

const EMPTY_LEVEL = { name: '', level: '', monthlyPrice: '', pointsPerMonth: '', features: '' };
const EMPTY_PLAN = { levelId: '', billingCycle: 'MONTHLY' as const, months: '1', autoRenew: false, originalPrice: '', price: '', firstTimePrice: '', discountLabel: '', firstTimeLabel: '', points: '', isActive: true };

export function SystemMembershipLevelsPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [levelModal, setLevelModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
  const [planModal, setPlanModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchLevels = async () => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getLevels();
      const data = res.data as any;
      setLevels(Array.isArray(data) ? data : data?.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLevels(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveLevel = async () => {
    if (!levelModal) return;
    setSaving(true);
    try {
      const { mode, data } = levelModal;
      const payload = {
        name: data.name,
        level: Number(data.level),
        monthlyPrice: data.monthlyPrice,
        pointsPerMonth: Number(data.pointsPerMonth),
        features: data.features ? data.features.split('\n').filter(Boolean) : [],
        isActive: data.isActive ?? true,
      };
      if (mode === 'create') {
        await membershipAdminApi.createLevel(payload);
      } else {
        await membershipAdminApi.updateLevel(data.id, payload);
      }
      setLevelModal(null);
      fetchLevels();
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlan = async () => {
    if (!planModal) return;
    setSaving(true);
    try {
      const { mode, data } = planModal;
      const payload = {
        levelId: data.levelId,
        billingCycle: data.billingCycle,
        months: Number(data.months),
        autoRenew: data.autoRenew,
        originalPrice: data.originalPrice,
        price: data.price,
        firstTimePrice: data.firstTimePrice || null,
        discountLabel: data.discountLabel || null,
        firstTimeLabel: data.firstTimeLabel || null,
        points: Number(data.points),
        isActive: data.isActive ?? true,
      };
      if (mode === 'create') {
        await membershipAdminApi.createPlan(payload);
      } else {
        await membershipAdminApi.updatePlan(data.id, payload);
      }
      setPlanModal(null);
      fetchLevels();
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = { border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminLevels')}</h1>
        <span className="flex-1" />
        <Button size="sm"  className="cursor-pointer" onClick={() => setLevelModal({ mode: 'create', data: { ...EMPTY_LEVEL } })}>
          <Plus className="w-3.5 h-3.5 mr-1" />{t('addLevel')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : levels.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium w-8" style={{ color: 'var(--muted)' }} />
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('levelName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('level')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('levelMonthlyPrice')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('levelPointsPerMonth')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('levelFeatures')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
              </tr>
            </thead>
              {levels.map((lv) => {
                const isExpanded = expanded.has(lv.id);
                return (
                  <tbody key={lv.id}>
                    <tr
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onClick={() => toggleExpand(lv.id)}
                    >
                      <td className="px-4 py-3">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                          : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{lv.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{lv.level}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>¥{lv.monthlyPrice}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{lv.pointsPerMonth}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>
                        {lv.features?.join(', ') ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm" variant="ghost" className="cursor-pointer"
                          onClick={() => setLevelModal({
                            mode: 'edit',
                            data: { ...lv, features: lv.features?.join('\n') ?? '' },
                          })}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ backgroundColor: 'var(--surface)' }}>
                          <div className="px-8 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                                {t('addPlan').replace('新增', '').replace('Add ', '')} ({lv.plans?.length ?? 0})
                              </span>
                              <Button
                                size="sm" variant="ghost" className="cursor-pointer"
                                onClick={() => setPlanModal({ mode: 'create', data: { ...EMPTY_PLAN, levelId: lv.id } })}
                              >
                                <Plus className="w-3 h-3 mr-1" />{t('addPlan')}
                              </Button>
                            </div>
                            {lv.plans && lv.plans.length > 0 ? (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('billingCycle')}</th>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('autoRenew')}</th>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('originalPrice')}</th>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('price')}</th>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('firstTimePrice')}</th>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('discountLabel')}</th>
                                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('points')}</th>
                                    <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{t('operations')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lv.plans.map((plan) => (
                                    <tr key={plan.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{plan.billingCycle}</td>
                                      <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{plan.autoRenew ? t('autoRenewOn') : t('autoRenewOff')}</td>
                                      <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>¥{plan.originalPrice}</td>
                                      <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>¥{plan.price}</td>
                                      <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{plan.firstTimePrice ? `¥${plan.firstTimePrice}` : '—'}</td>
                                      <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{plan.discountLabel ?? '—'}</td>
                                      <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{plan.points}</td>
                                      <td className="px-3 py-2 text-right">
                                        <Button
                                          size="sm" variant="ghost" className="cursor-pointer"
                                          onClick={() => setPlanModal({ mode: 'edit', data: { ...plan } })}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-xs py-2" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
          </table>
        )}
      </div>

      {/* Level Modal */}
      {levelModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setLevelModal(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {levelModal.mode === 'create' ? t('addLevel') : t('editLevel')}
              </h3>
              <button className="cursor-pointer" onClick={() => setLevelModal(null)}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('levelName')}</label>
                <Input value={levelModal.data.name} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, name: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('level')}</label>
                <Input type="number" value={String(levelModal.data.level)} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, level: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('monthlyPrice')}</label>
                <Input value={levelModal.data.monthlyPrice} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, monthlyPrice: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('pointsPerMonth')}</label>
                <Input type="number" value={String(levelModal.data.pointsPerMonth)} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, pointsPerMonth: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('features')}</label>
                <textarea
                  value={levelModal.data.features}
                  onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, features: e.target.value } })}
                  placeholder={t('featuresPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setLevelModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm"  className="cursor-pointer" disabled={saving} onClick={handleSaveLevel}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {planModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setPlanModal(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {planModal.mode === 'create' ? t('addPlan') : t('editPlan')}
              </h3>
              <button className="cursor-pointer" onClick={() => setPlanModal(null)}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('billingCycle')}</label>
                <select
                  value={planModal.data.billingCycle}
                  onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, billingCycle: e.target.value } })}
                  className="w-full px-3 py-2 text-sm rounded-md outline-none"
                  style={selectStyle}
                >
                  <option value="MONTHLY">{t('monthly')}</option>
                  <option value="QUARTERLY">{t('quarterly')}</option>
                  <option value="YEARLY">{t('yearly')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('months')}</label>
                <Input type="number" value={String(planModal.data.months)} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, months: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={planModal.data.autoRenew}
                  onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, autoRenew: e.target.checked } })}
                />
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('autoRenew')}</label>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('originalPrice')}</label>
                <Input value={planModal.data.originalPrice} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, originalPrice: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('price')}</label>
                <Input value={planModal.data.price} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, price: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('firstTimePrice')}</label>
                <Input value={planModal.data.firstTimePrice} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, firstTimePrice: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('discountLabel')}</label>
                <Input value={planModal.data.discountLabel} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, discountLabel: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('firstTimeLabel')}</label>
                <Input value={planModal.data.firstTimeLabel ?? ''} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, firstTimeLabel: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('points')}</label>
                <Input type="number" value={String(planModal.data.points)} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, points: e.target.value } })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setPlanModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm"  className="cursor-pointer" disabled={saving} onClick={handleSavePlan}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
