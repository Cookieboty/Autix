'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { Plus, Pencil, X, Stethoscope, CopyPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  membershipAdminApi,
  type GenerationPricingRule,
  type PricingRulePreviewResult,
} from '@/lib/api';

type RuleForm = {
  id?: string;
  taskType: string;
  name: string;
  modelProvider: string;
  modelName: string;
  quality: string;
  resolution: string;
  modelTier: string;
  baseUnit: string;
  baseCost: number | string;
  fixedExtraCost: number | string;
  inputTokenCostPerK: number | string;
  outputTokenCostPerK: number | string;
  contextTokenCostPerK: number | string;
  toolCallCost: number | string;
  batchUnitCost: number | string;
  referenceImageFixedCost: number | string;
  reasoningMultiplier: number | string;
  isActive: boolean;
};

const EMPTY_RULE: RuleForm = {
  taskType: '',
  name: '',
  modelProvider: '',
  modelName: '',
  quality: '',
  resolution: '',
  modelTier: '',
  baseUnit: 'task',
  baseCost: 0,
  fixedExtraCost: 0,
  inputTokenCostPerK: '',
  outputTokenCostPerK: '',
  contextTokenCostPerK: '',
  toolCallCost: '',
  batchUnitCost: '',
  referenceImageFixedCost: '',
  reasoningMultiplier: 1,
  isActive: true,
};

const PROMPT_RULE_TEMPLATES: Array<Pick<RuleForm, 'taskType' | 'name' | 'baseUnit' | 'baseCost' | 'contextTokenCostPerK'>> = [
  { taskType: 'prompt_optimize_generation', name: '图片/视频 Prompt 增强', baseUnit: 'task', baseCost: 20, contextTokenCostPerK: '' },
  { taskType: 'prompt_optimize_pro', name: '专业优化 Prompt', baseUnit: 'task', baseCost: 15, contextTokenCostPerK: 5 },
  { taskType: 'prompt_optimize_quick', name: '快速优化 Prompt', baseUnit: 'task', baseCost: 5, contextTokenCostPerK: '' },
];

const BASE_UNIT_OPTIONS = ['task', 'image', 'second', 'message', 'token', 'tool_call'];
const MODEL_TIER_OPTIONS = ['', 'fast', 'standard', 'pro_reasoning'];

function optionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function toInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function optionalInt(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  return toInt(text);
}

function optionalNumber(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  return Math.max(0, Number(text) || 0);
}

function ruleToForm(rule: GenerationPricingRule): RuleForm {
  return {
    id: rule.id,
    taskType: rule.taskType,
    name: rule.name,
    modelProvider: rule.modelProvider ?? '',
    modelName: rule.modelName ?? '',
    quality: rule.quality ?? '',
    resolution: rule.resolution ?? '',
    modelTier: rule.modelTier ?? '',
    baseUnit: rule.baseUnit,
    baseCost: rule.baseCost,
    fixedExtraCost: rule.fixedExtraCost ?? 0,
    inputTokenCostPerK: rule.inputTokenCostPerK ?? '',
    outputTokenCostPerK: rule.outputTokenCostPerK ?? '',
    contextTokenCostPerK: rule.contextTokenCostPerK ?? '',
    toolCallCost: rule.toolCallCost ?? '',
    batchUnitCost: rule.batchUnitCost ?? '',
    referenceImageFixedCost: rule.referenceImageFixedCost ?? '',
    reasoningMultiplier: rule.reasoningMultiplier ?? 1,
    isActive: rule.isActive !== false,
  };
}

export default function AdminTaskCostsPage() {
  const t = useTranslations('membership');
  const tCommon = useTranslations('common');

  const [rules, setRules] = useState<GenerationPricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [ruleModal, setRuleModal] = useState<{ mode: 'create' | 'edit'; data: RuleForm } | null>(null);
  const [saving, setSaving] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [previewRule, setPreviewRule] = useState<GenerationPricingRule | null>(null);
  const [previewForm, setPreviewForm] = useState({ quantity: 1, seconds: 5, membershipLevel: '', grantType: '' });
  const [previewResult, setPreviewResult] = useState<PricingRulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const promptRules = useMemo(
    () => rules.filter((rule) => rule.taskType.startsWith('prompt_optimize')),
    [rules],
  );

  const fetchRules = async () => {
    setLoading(true);
    try {
      const ruleRes = await membershipAdminApi.getPricingRules();
      const ruleData = ruleRes.data as any;
      setRules(Array.isArray(ruleData) ? ruleData : ruleData?.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleSaveRule = async () => {
    if (!ruleModal) return;
    setSaving(true);
    try {
      const data = ruleModal.data;
      const payload = {
        taskType: String(data.taskType ?? '').trim(),
        name: String(data.name ?? '').trim(),
        modelProvider: optionalText(data.modelProvider),
        modelName: optionalText(data.modelName),
        quality: optionalText(data.quality),
        resolution: optionalText(data.resolution),
        modelTier: optionalText(data.modelTier),
        baseUnit: data.baseUnit || 'task',
        baseCost: toInt(data.baseCost),
        fixedExtraCost: toInt(data.fixedExtraCost),
        inputTokenCostPerK: optionalNumber(data.inputTokenCostPerK),
        outputTokenCostPerK: optionalNumber(data.outputTokenCostPerK),
        contextTokenCostPerK: optionalNumber(data.contextTokenCostPerK),
        toolCallCost: optionalInt(data.toolCallCost),
        batchUnitCost: optionalInt(data.batchUnitCost),
        referenceImageFixedCost: optionalInt(data.referenceImageFixedCost),
        reasoningMultiplier: optionalNumber(data.reasoningMultiplier) ?? 1,
        isActive: data.isActive !== false,
      };
      if (ruleModal.mode === 'create') {
        await membershipAdminApi.createPricingRule(payload);
      } else {
        await membershipAdminApi.updatePricingRule(data.id!, payload);
      }
      setRuleModal(null);
      await fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const openRuleModal = (mode: 'create' | 'edit', rule?: GenerationPricingRule, template?: Partial<RuleForm>) => {
    setRuleModal({
      mode,
      data: rule ? ruleToForm(rule) : { ...EMPTY_RULE, ...template },
    });
  };

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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminTaskCosts')}</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>所有积分扣减统一使用生成计费规则，规则缺失时服务端会阻断执行。</p>
        </div>
        <span className="flex-1" />
        <Button size="sm" className="cursor-pointer" onClick={() => openRuleModal('create')}>
          <Plus className="mr-1 h-3.5 w-3.5" />新增计费规则
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : (
          <div>
            <section>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Prompt 优化规则</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>图片工作台与 Artifact 优化会记录来源和模型，并从这些规则扣费。</p>
                </div>
                <span className="flex-1" />
                {PROMPT_RULE_TEMPLATES.map((template) => (
                  <Button
                    key={template.taskType}
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => openRuleModal('create', undefined, template)}
                  >
                    <CopyPlus className="mr-1 h-3.5 w-3.5" />{template.baseCost} 分
                  </Button>
                ))}
              </div>
              {promptRules.length === 0 ? (
                <div className="px-4 py-6 text-sm" style={{ color: 'var(--muted)' }}>
                  暂无 Prompt 优化规则。请至少新增 prompt_optimize_generation 和 prompt_optimize_pro。
                </div>
              ) : (
                <RulesTable rules={promptRules} onPreview={openPreview} onEdit={(rule) => openRuleModal('edit', rule)} />
              )}
            </section>

            <section>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>全部生成计费规则</h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>图片、视频、对话、工具调用和批量任务都在这里维护。</p>
              </div>
              {rules.length === 0 ? (
                <div className="px-4 py-8 text-sm" style={{ color: 'var(--muted)' }}>
                  暂无计费规则。新增规则后，相关生成和优化功能才会允许扣费执行。
                </div>
              ) : (
                <RulesTable rules={rules} onPreview={openPreview} onEdit={(rule) => openRuleModal('edit', rule)} />
              )}
            </section>
          </div>
        )}
      </div>

      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-3xl rounded-lg p-5" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {ruleModal.mode === 'create' ? '新增计费规则' : '编辑计费规则'}
              </h3>
              <button className="cursor-pointer p-1" onClick={() => setRuleModal(null)}>
                <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
              <Field label="任务类型">
                <Input value={ruleModal.data.taskType} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, taskType: e.target.value } })} />
              </Field>
              <Field label="显示名称">
                <Input value={ruleModal.data.name} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, name: e.target.value } })} />
              </Field>
              <Field label="基础单位">
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  value={ruleModal.data.baseUnit}
                  onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, baseUnit: e.target.value } })}
                >
                  {BASE_UNIT_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="基础积分">
                <Input type="number" min={0} value={ruleModal.data.baseCost} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, baseCost: e.target.value } })} />
              </Field>
              <Field label="模型提供方">
                <Input placeholder="openai-official" value={ruleModal.data.modelProvider} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, modelProvider: e.target.value } })} />
              </Field>
              <Field label="模型名称">
                <Input placeholder="gpt-4o-mini" value={ruleModal.data.modelName} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, modelName: e.target.value } })} />
              </Field>
              <Field label="模型档位">
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  value={ruleModal.data.modelTier}
                  onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, modelTier: e.target.value } })}
                >
                  {MODEL_TIER_OPTIONS.map((value) => <option key={value || 'empty'} value={value}>{value || '通用'}</option>)}
                </select>
              </Field>
              <Field label="质量">
                <Input placeholder="low / medium / high" value={ruleModal.data.quality} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, quality: e.target.value } })} />
              </Field>
              <Field label="分辨率">
                <Input placeholder="720p / 1024x1024" value={ruleModal.data.resolution} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, resolution: e.target.value } })} />
              </Field>
              <Field label="固定附加积分">
                <Input type="number" min={0} value={ruleModal.data.fixedExtraCost} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, fixedExtraCost: e.target.value } })} />
              </Field>
              <Field label="输入 Token / K">
                <Input type="number" min={0} value={ruleModal.data.inputTokenCostPerK} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, inputTokenCostPerK: e.target.value } })} />
              </Field>
              <Field label="输出 Token / K">
                <Input type="number" min={0} value={ruleModal.data.outputTokenCostPerK} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, outputTokenCostPerK: e.target.value } })} />
              </Field>
              <Field label="上下文 Token / K">
                <Input type="number" min={0} value={ruleModal.data.contextTokenCostPerK} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, contextTokenCostPerK: e.target.value } })} />
              </Field>
              <Field label="工具调用积分">
                <Input type="number" min={0} value={ruleModal.data.toolCallCost} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, toolCallCost: e.target.value } })} />
              </Field>
              <Field label="批量单位积分">
                <Input type="number" min={0} value={ruleModal.data.batchUnitCost} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, batchUnitCost: e.target.value } })} />
              </Field>
              <Field label="参考图固定积分">
                <Input type="number" min={0} value={ruleModal.data.referenceImageFixedCost} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, referenceImageFixedCost: e.target.value } })} />
              </Field>
              <Field label="推理倍率">
                <Input type="number" min={0} step="0.1" value={ruleModal.data.reasoningMultiplier} onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, reasoningMultiplier: e.target.value } })} />
              </Field>
              <label className="flex items-center gap-2 pt-6 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={ruleModal.data.isActive !== false}
                  onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, isActive: e.target.checked } })}
                />
                启用规则
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setRuleModal(null)}>{tCommon('cancel')}</Button>
              <Button size="sm" className="cursor-pointer" disabled={saving} onClick={handleSaveRule}>{tCommon('save')}</Button>
            </div>
          </div>
        </div>
      )}

      {previewRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg p-5"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  规则诊断 · {previewRule.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {previewRule.taskType} / {previewRule.baseUnit}
                </p>
              </div>
              <button onClick={closePreview} className="cursor-pointer p-1" style={{ color: 'var(--muted)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              {previewRule.baseUnit === 'image' && (
                <Field label="数量 (quantity)">
                  <Input type="number" min={1} value={previewForm.quantity} onChange={(e) => setPreviewForm({ ...previewForm, quantity: Number(e.target.value) })} />
                </Field>
              )}
              {previewRule.baseUnit === 'second' && (
                <Field label="时长 (seconds)">
                  <Input type="number" min={1} value={previewForm.seconds} onChange={(e) => setPreviewForm({ ...previewForm, seconds: Number(e.target.value) })} />
                </Field>
              )}
              <Field label="membershipLevel（可选）">
                <Input value={previewForm.membershipLevel} onChange={(e) => setPreviewForm({ ...previewForm, membershipLevel: e.target.value })} placeholder="如 pro / vip" />
              </Field>
              <Field label="grantType（可选）">
                <Input value={previewForm.grantType} onChange={(e) => setPreviewForm({ ...previewForm, grantType: e.target.value })} placeholder="如 monthly / purchased" />
              </Field>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <Button size="sm" className="cursor-pointer" disabled={previewing} onClick={runPreview}>
                {previewing ? '诊断中...' : '运行诊断'}
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
                    <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>诊断警告</h3>
                    <ul className="space-y-1 text-xs">
                      {previewResult.warnings.map((w, idx) => (
                        <li key={idx} style={{ color: 'var(--foreground)' }}>
                          <span className="mr-2 font-mono" style={{ color: 'var(--muted)' }}>[{w.code}]</span>
                          {w.message}
                          {w.field && <span className="ml-2 font-mono" style={{ color: 'var(--muted)' }}>({w.field})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', color: 'var(--foreground)' }}>
                    无诊断警告
                  </div>
                )}

                {previewResult.estimateError && (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--foreground)' }}>
                    估算失败：{previewResult.estimateError}
                  </div>
                )}

                {previewResult.estimate && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--foreground)' }}>估算结果</h3>
                    <div className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>
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
                  <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                    命中规则：{previewResult.matchedRule.name} ({previewResult.matchedRule.id})
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="cursor-pointer" onClick={closePreview}>{tCommon('close') ?? '关闭'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function RulesTable({
  rules,
  onPreview,
  onEdit,
}: {
  rules: GenerationPricingRule[];
  onPreview: (rule: GenerationPricingRule) => void;
  onEdit: (rule: GenerationPricingRule) => void;
}) {
  const t = useTranslations('membership');

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>任务</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>名称</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>单位</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>基础积分</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>模型/规格</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>状态</th>
          <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>操作</th>
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
              {[rule.modelProvider, rule.modelTier, rule.quality, rule.resolution, rule.modelName].filter(Boolean).join(' / ') || '通用'}
            </td>
            <td className="px-4 py-3">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: rule.isActive !== false ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                  color: rule.isActive !== false ? 'var(--success)' : 'var(--muted)',
                }}
              >
                {rule.isActive !== false ? t('active') : t('inactive')}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onPreview(rule)}>
                  <Stethoscope className="mr-1 h-3.5 w-3.5" />预览
                </Button>
                <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onEdit(rule)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
