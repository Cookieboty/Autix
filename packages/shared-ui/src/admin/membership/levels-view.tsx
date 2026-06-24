'use client';

import { useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '../../ui';
import { formatCurrency } from '../../format';
import { Plus, Pencil, ChevronDown, ChevronRight, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useAdminMembershipLevelsQuery,
  useCreateAdminMembershipLevelMutation,
  useCreateAdminMembershipPlanMutation,
  useDeleteAdminMembershipLevelMutation,
  useDeleteAdminMembershipPlanMutation,
  useUpdateAdminMembershipLevelMutation,
  useUpdateAdminMembershipPlanMutation,
  type MembershipLevel,
} from '@autix/shared-store';
import { VIDEO_RESOLUTION_OPTIONS, type VideoResolution } from '@autix/domain/video';

const EMPTY_PLAN = { levelId: '', billingCycle: 'MONTHLY' as const, months: '1', autoRenew: false, originalPrice: '', price: '', firstTimePrice: '', discountLabel: '', firstTimeLabel: '', points: '', isActive: true };

type MembershipFeatureConfig = {
  recommended: boolean;
  removeWatermark: boolean;
  commercialLicense: boolean;
  seedance: {
    enabled: boolean;
    maxResolution: VideoResolution;
    maxDurationSeconds: number;
    concurrency: number;
  };
  queuePriority: string;
  batchGeneration: string;
  historyRetentionDays: number;
  teamSpace: boolean;
  invoice: string;
};

const DEFAULT_FEATURES: MembershipFeatureConfig = {
  recommended: false,
  removeWatermark: false,
  commercialLicense: false,
  seedance: {
    enabled: false,
    maxResolution: '720p',
    maxDurationSeconds: 5,
    concurrency: 1,
  },
  queuePriority: '',
  batchGeneration: '',
  historyRetentionDays: 30,
  teamSpace: false,
  invoice: '',
};

function cloneFeatures(features: MembershipFeatureConfig = DEFAULT_FEATURES): MembershipFeatureConfig {
  return {
    ...features,
    seedance: { ...features.seedance },
  };
}

function emptyLevelData() {
  return {
    name: '',
    level: '',
    monthlyPrice: '',
    pointsPerMonth: '',
    features: cloneFeatures(),
    isActive: true,
    sort: '',
  };
}

function toFeatureConfig(features: MembershipLevel['features'] | unknown): MembershipFeatureConfig {
  if (!features || Array.isArray(features) || typeof features !== 'object') {
    return cloneFeatures();
  }
  const source = features as Record<string, unknown>;
  const seedance = source.seedance && typeof source.seedance === 'object'
    ? source.seedance as Record<string, unknown>
    : {};
  const maxResolution = VIDEO_RESOLUTION_OPTIONS.find(
    (option) => option.value === seedance.maxResolution,
  )?.value ?? '720p';
  return {
    recommended: Boolean(source.recommended),
    removeWatermark: Boolean(source.removeWatermark),
    commercialLicense: Boolean(source.commercialLicense),
    seedance: {
      enabled: Boolean(seedance.enabled),
      maxResolution,
      maxDurationSeconds: typeof seedance.maxDurationSeconds === 'number'
        ? seedance.maxDurationSeconds
        : 5,
      concurrency: typeof seedance.concurrency === 'number' ? seedance.concurrency : 1,
    },
    queuePriority: typeof source.queuePriority === 'string' ? source.queuePriority : '',
    batchGeneration: typeof source.batchGeneration === 'string' ? source.batchGeneration : '',
    historyRetentionDays: typeof source.historyRetentionDays === 'number'
      ? source.historyRetentionDays
      : 30,
    teamSpace: Boolean(source.teamSpace),
    invoice: typeof source.invoice === 'string' ? source.invoice : '',
  };
}

function serializeFeatures(features: MembershipFeatureConfig) {
  return {
    ...(features.recommended ? { recommended: true } : {}),
    removeWatermark: features.removeWatermark,
    commercialLicense: features.commercialLicense,
    seedance: {
      enabled: features.seedance.enabled,
      maxResolution: features.seedance.maxResolution,
      maxDurationSeconds: features.seedance.maxDurationSeconds,
      concurrency: features.seedance.concurrency,
    },
    ...(features.queuePriority ? { queuePriority: features.queuePriority } : {}),
    ...(features.batchGeneration ? { batchGeneration: features.batchGeneration } : {}),
    historyRetentionDays: features.historyRetentionDays,
    ...(features.teamSpace ? { teamSpace: true } : {}),
    ...(features.invoice ? { invoice: features.invoice } : {}),
  };
}

type TranslationValues = Record<string, string | number | Date>;

function summarizeFeatures(features: MembershipLevel['features'], t: (key: string, values?: TranslationValues) => string) {
  if (!features) return '—';
  if (Array.isArray(features)) return features.join(', ');
  const f = features as Record<string, unknown>;
  const items = [
    f.recommended ? t('recommendedBadge') : null,
    f.removeWatermark ? t('featureRemoveWatermark') : null,
    f.commercialLicense ? t('featureCommercialLicense') : null,
    (f.seedance as Record<string, unknown>)?.enabled ? t('featureVideoGeneration') : null,
    f.historyRetentionDays ? t('featureHistoryRetention', { days: f.historyRetentionDays as number }) : null,
  ].filter(Boolean);
  return items.length ? items.join(', ') : JSON.stringify(features);
}

export function MembershipLevelsView() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const { data: levels = [], isLoading: loading } = useAdminMembershipLevelsQuery();
  const createLevelMutation = useCreateAdminMembershipLevelMutation();
  const updateLevelMutation = useUpdateAdminMembershipLevelMutation();
  const deleteLevelMutation = useDeleteAdminMembershipLevelMutation();
  const createPlanMutation = useCreateAdminMembershipPlanMutation();
  const updatePlanMutation = useUpdateAdminMembershipPlanMutation();
  const deletePlanMutation = useDeleteAdminMembershipPlanMutation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [levelModal, setLevelModal] = useState<{ mode: 'create' | 'edit'; data: Record<string, unknown> } | null>(null);
  const [planModal, setPlanModal] = useState<{ mode: 'create' | 'edit'; data: Record<string, unknown> } | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveLevel = async () => {
    if (!levelModal) return;
    setSaving(true);
    try {
      const { mode, data } = levelModal;
      const payload = {
        name: data.name as string,
        level: Number(data.level),
        monthlyPrice: data.monthlyPrice as string,
        pointsPerMonth: Number(data.pointsPerMonth),
        features: serializeFeatures(toFeatureConfig(data.features)),
        isActive: (data.isActive as boolean) ?? true,
        sort: Number(data.sort ?? data.level ?? 0),
      };
      if (mode === 'create') {
        await createLevelMutation.mutateAsync(payload);
      } else {
        await updateLevelMutation.mutateAsync({ id: data.id as string, data: payload });
      }
      setLevelModal(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLevel = async (level: MembershipLevel) => {
    if (!window.confirm(`${tCommon('confirmDelete')} ${level.name}?`)) return;
    await deleteLevelMutation.mutateAsync(level.id);
  };

  const handleDeletePlan = async (plan: { id: string; billingCycle: string }) => {
    if (!window.confirm(`${tCommon('confirmDelete')} ${plan.billingCycle}?`)) return;
    await deletePlanMutation.mutateAsync(plan.id);
  };

  const handleSavePlan = async () => {
    if (!planModal) return;
    setSaving(true);
    try {
      const { mode, data } = planModal;
      const payload = {
        levelId: data.levelId as string,
        billingCycle: data.billingCycle as string,
        months: Number(data.months),
        autoRenew: data.autoRenew as boolean,
        originalPrice: data.originalPrice as string,
        price: data.price as string,
        firstTimePrice: (data.firstTimePrice as string) || null,
        discountLabel: (data.discountLabel as string) || null,
        firstTimeLabel: (data.firstTimeLabel as string) || null,
        points: Number(data.points),
        isActive: (data.isActive as boolean) ?? true,
      };
      if (mode === 'create') {
        await createPlanMutation.mutateAsync(payload);
      } else {
        await updatePlanMutation.mutateAsync({ id: data.id as string, data: payload });
      }
      setPlanModal(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminLevels')}</h1>
        <span className="flex-1" />
        <Button size="sm" className="cursor-pointer" onClick={() => setLevelModal({ mode: 'create', data: emptyLevelData() })}>
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
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('sortOrder')}</th>
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
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{lv.sort ?? lv.level}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatCurrency(lv.monthlyPrice)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{lv.pointsPerMonth}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>
                      {summarizeFeatures(lv.features, t)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm" variant="ghost" className="cursor-pointer"
                        onClick={() => setLevelModal({
                          mode: 'edit',
                          data: { ...lv, sort: lv.sort ?? lv.level, features: toFeatureConfig(lv.features) },
                        })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="cursor-pointer"
                        disabled={deleteLevelMutation.isPending}
                        onClick={() => handleDeleteLevel(lv)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={8} style={{ backgroundColor: 'var(--surface)' }}>
                        <div className="px-8 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                              {t('plansCount', { count: lv.plans?.length ?? 0 })}
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
                                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{formatCurrency(plan.originalPrice)}</td>
                                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{formatCurrency(plan.price)}</td>
                                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{plan.firstTimePrice ? formatCurrency(plan.firstTimePrice) : '—'}</td>
                                    <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{plan.discountLabel ?? '—'}</td>
                                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{plan.points}</td>
                                    <td className="px-3 py-2 text-right">
                                      <Button
                                        size="sm" variant="ghost" className="cursor-pointer"
                                        onClick={() => setPlanModal({ mode: 'edit', data: { ...plan } })}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost" className="cursor-pointer"
                                        disabled={deletePlanMutation.isPending}
                                        onClick={() => handleDeletePlan(plan)}
                                      >
                                        <Trash2 className="w-3 h-3" />
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

      {levelModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--modal-backdrop)' }} onClick={() => setLevelModal(null)} />
          <div style={{ position: 'relative', backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 760, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto' }}>
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
                <Input value={levelModal.data.name as string} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, name: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('level')}</label>
                <Input type="number" value={String(levelModal.data.level)} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, level: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('monthlyPrice')}</label>
                <Input value={levelModal.data.monthlyPrice as string} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, monthlyPrice: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('pointsPerMonth')}</label>
                <Input type="number" value={String(levelModal.data.pointsPerMonth)} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, pointsPerMonth: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('sortOrder')}</label>
                <Input type="number" min={0} value={String(levelModal.data.sort ?? '')} onChange={(e) => setLevelModal({ ...levelModal, data: { ...levelModal.data, sort: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--muted)' }}>{t('features')}</label>
                <FeatureConfigEditor
                  value={toFeatureConfig(levelModal.data.features)}
                  onChange={(features) => setLevelModal({
                    ...levelModal,
                    data: { ...levelModal.data, features },
                  })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setLevelModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm" className="cursor-pointer" disabled={saving} onClick={handleSaveLevel}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}

      {planModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--modal-backdrop)' }} onClick={() => setPlanModal(null)} />
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
                <Select
                  value={planModal.data.billingCycle as string}
                  onValueChange={(val) => setPlanModal({ ...planModal, data: { ...planModal.data, billingCycle: val } })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">{t('monthly')}</SelectItem>
                    <SelectItem value="QUARTERLY">{t('quarterly')}</SelectItem>
                    <SelectItem value="YEARLY">{t('yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('months')}</label>
                <Input type="number" value={String(planModal.data.months)} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, months: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={planModal.data.autoRenew as boolean}
                  onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, autoRenew: e.target.checked } })}
                />
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('autoRenew')}</label>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('originalPrice')}</label>
                <Input value={(planModal.data.originalPrice as string) ?? ''} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, originalPrice: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('price')}</label>
                <Input value={planModal.data.price as string} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, price: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('firstTimePrice')}</label>
                <Input value={(planModal.data.firstTimePrice as string) ?? ''} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, firstTimePrice: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('discountLabel')}</label>
                <Input value={(planModal.data.discountLabel as string) ?? ''} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, discountLabel: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('firstTimeLabel')}</label>
                <Input value={(planModal.data.firstTimeLabel as string) ?? ''} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, firstTimeLabel: e.target.value } })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>{t('points')}</label>
                <Input type="number" value={String(planModal.data.points)} onChange={(e) => setPlanModal({ ...planModal, data: { ...planModal.data, points: e.target.value } })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setPlanModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm" className="cursor-pointer" disabled={saving} onClick={handleSavePlan}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureConfigEditor({
  value,
  onChange,
}: {
  value: MembershipFeatureConfig;
  onChange: (value: MembershipFeatureConfig) => void;
}) {
  const t = useTranslations('membership');
  const update = (partial: Partial<MembershipFeatureConfig>) => {
    onChange({ ...value, ...partial });
  };
  const updateSeedance = (partial: Partial<MembershipFeatureConfig['seedance']>) => {
    onChange({ ...value, seedance: { ...value.seedance, ...partial } });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
      <FeatureSwitch
        label={t('recommendedBadge')}
        checked={value.recommended}
        onCheckedChange={(checked) => update({ recommended: checked })}
      />
      <FeatureSwitch
        label={t('benefitRemoveWatermark')}
        checked={value.removeWatermark}
        onCheckedChange={(checked) => update({ removeWatermark: checked })}
      />
      <FeatureSwitch
        label={t('benefitCommercialLicense')}
        checked={value.commercialLicense}
        onCheckedChange={(checked) => update({ commercialLicense: checked })}
      />
      <FeatureSwitch
        label={t('benefitTeamSpace')}
        checked={value.teamSpace}
        onCheckedChange={(checked) => update({ teamSpace: checked })}
      />

      <div className="rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              {t('benefitVideoGeneration')}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {t('benefitVideoGenerationHint')}
            </div>
          </div>
          <Switch
            checked={value.seedance.enabled}
            onCheckedChange={(checked) => updateSeedance({ enabled: checked })}
          />
        </div>

        {value.seedance.enabled && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                {t('benefitVideoResolution')}
              </label>
              <Select
                value={value.seedance.maxResolution}
                onValueChange={(resolution) => updateSeedance({
                  maxResolution: resolution as MembershipFeatureConfig['seedance']['maxResolution'],
                })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_RESOLUTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                {t('benefitVideoDuration')}
              </label>
              <Input
                type="number"
                min={1}
                value={String(value.seedance.maxDurationSeconds)}
                onChange={(e) => updateSeedance({ maxDurationSeconds: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                {t('benefitVideoConcurrency')}
              </label>
              <Input
                type="number"
                min={1}
                value={String(value.seedance.concurrency)}
                onChange={(e) => updateSeedance({ concurrency: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
            {t('benefitHistoryRetentionDays')}
          </label>
          <Input
            type="number"
            min={0}
            value={String(value.historyRetentionDays)}
            onChange={(e) => update({ historyRetentionDays: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
            {t('benefitQueuePriority')}
          </label>
          <Input
            value={value.queuePriority}
            placeholder={t('benefitQueuePriorityPlaceholder')}
            onChange={(e) => update({ queuePriority: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
            {t('benefitBatchGeneration')}
          </label>
          <Input
            value={value.batchGeneration}
            placeholder={t('benefitBatchGenerationPlaceholder')}
            onChange={(e) => update({ batchGeneration: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
          {t('benefitInvoice')}
        </label>
        <Input
          value={value.invoice}
          placeholder={t('benefitInvoicePlaceholder')}
          onChange={(e) => update({ invoice: e.target.value })}
        />
      </div>
    </div>
  );
}

function FeatureSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground)' }}>
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      {label}
    </label>
  );
}
