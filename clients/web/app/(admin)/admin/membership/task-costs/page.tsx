'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { Plus, Pencil, X, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  membershipAdminApi,
  type GenerationPricingRule,
  type PricingRulePreviewResult,
} from '@/lib/api';

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
  const [rules, setRules] = useState<GenerationPricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
  const [saving, setSaving] = useState(false);

  // P2-C-3: 预览诊断弹窗状态
  const [previewing, setPreviewing] = useState(false);
  const [previewRule, setPreviewRule] = useState<GenerationPricingRule | null>(null);
  const [previewForm, setPreviewForm] = useState({ quantity: 1, seconds: 5, membershipLevel: '', grantType: '' });
  const [previewResult, setPreviewResult] = useState<PricingRulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const res = await membershipAdminApi.getTaskCosts();
      const ruleRes = await membershipAdminApi.getPricingRules();
      const data = res.data as any;
      const ruleData = ruleRes.data as any;
      setCosts(Array.isArray(data) ? data : data?.items ?? []);
      setRules(Array.isArray(ruleData) ? ruleData : ruleData?.items ?? []);
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

  // P2-C-3: 调用 /admin/points/pricing-rules/preview，呈现 estimate + warnings
  const openPreview = (rule: GenerationPricingRule) => {
    setPreviewRule(rule);
    setPreviewResult(null);
    setPreviewError(null);
    setPreviewForm({
      quantity: rule.baseUnit === 'image' ? 1 : 0,
      seconds: rule.baseUnit === 'second' ? 5 : 0,
      membershipLevel: '',
      grantType: '',
    });
  };

  const runPreview = async () => {
    if (!previewRule) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const payload: Record<string, unknown> = {
        taskType: previewRule.taskType,
        modelProvider: previewRule.modelProvider ?? undefined,
        modelName: previewRule.modelName ?? undefined,
        quality: previewRule.quality ?? undefined,
        resolution: previewRule.resolution ?? undefined,
        modelTier: previewRule.modelTier ?? undefined,
      };
      if (previewForm.quantity > 0) payload.quantity = Number(previewForm.quantity);
      if (previewForm.seconds > 0) payload.seconds = Number(previewForm.seconds);
      if (previewForm.membershipLevel.trim()) payload.membershipLevel = previewForm.membershipLevel.trim();
      if (previewForm.grantType.trim()) payload.grantType = previewForm.grantType.trim();

      const res = await membershipAdminApi.previewPricingRule(payload);
      setPreviewResult(res.data);
    } catch (err: any) {
      setPreviewError(err?.response?.data?.message ?? err?.message ?? '诊断失败');
    } finally {
      setPreviewing(false);
    }
  };

  const closePreview = () => {
    setPreviewRule(null);
    setPreviewResult(null);
    setPreviewError(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminTaskCosts')}</h1>
        <span className="flex-1" />
        <Button size="sm" className="cursor-pointer" onClick={() => setModal({ mode: 'create', data: { ...EMPTY_COST } })}>
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
          <div className="space-y-6">
            <section>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>生成计费规则</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>图片、视频、对话、Prompt 优化均从服务端规则估算，不需要前端写死价格。</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>任务</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>名称</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>单位</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>基础积分</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>模型/规格</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>状态</th>
                    <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>诊断</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{rule.taskType}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{rule.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{rule.baseUnit}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{rule.baseCost}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                        {[rule.modelTier, rule.quality, rule.resolution, rule.modelName].filter(Boolean).join(' / ') || '通用'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: rule.isActive !== false ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                            color: rule.isActive !== false ? 'var(--success)' : 'var(--muted)',
                          }}
                        >
                          {rule.isActive !== false ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => openPreview(rule)}
                        >
                          <Stethoscope className="w-3.5 h-3.5 mr-1" />
                          预览
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>旧任务消耗</h2>
              </div>
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
            </section>
          </div>
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
              <Button size="sm" className="cursor-pointer" disabled={saving} onClick={handleSave}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* P2-C-3: Pricing rule preview diagnostics */}
      {previewRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="w-full max-w-2xl rounded-lg p-5 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  规则诊断 · {previewRule.name}
                </h2>
                <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
                  {previewRule.taskType} / {previewRule.baseUnit}
                </p>
              </div>
              <button onClick={closePreview} className="p-1 cursor-pointer" style={{ color: 'var(--muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {previewRule.baseUnit === 'image' && (
                <label className="text-xs" style={{ color: 'var(--muted)' }}>
                  数量 (quantity)
                  <Input
                    type="number"
                    min={1}
                    value={previewForm.quantity}
                    onChange={(e) => setPreviewForm({ ...previewForm, quantity: Number(e.target.value) })}
                    className="mt-1"
                  />
                </label>
              )}
              {previewRule.baseUnit === 'second' && (
                <label className="text-xs" style={{ color: 'var(--muted)' }}>
                  时长 (seconds)
                  <Input
                    type="number"
                    min={1}
                    value={previewForm.seconds}
                    onChange={(e) => setPreviewForm({ ...previewForm, seconds: Number(e.target.value) })}
                    className="mt-1"
                  />
                </label>
              )}
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                membershipLevel（可选）
                <Input
                  value={previewForm.membershipLevel}
                  onChange={(e) => setPreviewForm({ ...previewForm, membershipLevel: e.target.value })}
                  placeholder="如 pro / vip"
                  className="mt-1"
                />
              </label>
              <label className="text-xs" style={{ color: 'var(--muted)' }}>
                grantType（可选）
                <Input
                  value={previewForm.grantType}
                  onChange={(e) => setPreviewForm({ ...previewForm, grantType: e.target.value })}
                  placeholder="如 monthly / purchased"
                  className="mt-1"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Button size="sm" className="cursor-pointer" disabled={previewing} onClick={runPreview}>
                {previewing ? '诊断中…' : '运行诊断'}
              </Button>
              {previewError && (
                <span className="text-xs" style={{ color: 'var(--danger, #ef4444)' }}>
                  {previewError}
                </span>
              )}
            </div>

            {previewResult && (
              <div className="space-y-4">
                {previewResult.warnings && previewResult.warnings.length > 0 ? (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.35)' }}>
                    <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>诊断警告</h3>
                    <ul className="space-y-1 text-xs">
                      {previewResult.warnings.map((w, idx) => (
                        <li key={idx} style={{ color: 'var(--foreground)' }}>
                          <span className="font-mono mr-2" style={{ color: 'var(--muted)' }}>[{w.code}]</span>
                          {w.message}
                          {w.field && (
                            <span className="ml-2 font-mono" style={{ color: 'var(--muted)' }}>({w.field})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', color: 'var(--foreground)' }}>
                    ✓ 无诊断警告
                  </div>
                )}

                {previewResult.estimateError && (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--foreground)' }}>
                    估算失败：{previewResult.estimateError}
                  </div>
                )}

                {previewResult.estimate && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>估算结果</h3>
                    <div className="text-sm mb-2" style={{ color: 'var(--foreground)' }}>
                      预计消耗：<span className="font-semibold" style={{ color: 'var(--brand)' }}>{previewResult.estimate.estimatedCost}</span> 积分
                    </div>
                    {previewResult.estimate.breakdown && previewResult.estimate.breakdown.length > 0 && (
                      <table className="w-full text-xs">
                        <tbody>
                          {previewResult.estimate.breakdown.map((b, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="py-1.5" style={{ color: 'var(--muted)' }}>{b.label}</td>
                              <td className="py-1.5 text-right font-mono" style={{ color: 'var(--foreground)' }}>{b.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {previewResult.matchedRule && (
                  <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
                    命中规则：{previewResult.matchedRule.name} ({previewResult.matchedRule.id})
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={closePreview}>{tCommon('close') ?? '关闭'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
