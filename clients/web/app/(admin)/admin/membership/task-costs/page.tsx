'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@autix/shared-ui/ui';
import { CheckCircle2, Pencil, Plus, Stethoscope, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  membershipAdminApi,
  type GenerationPricingRule,
  type PricingRulePreviewResult,
} from '@/lib/api';

type RuleField =
  | 'baseCost'
  | 'inputTokenCostPerK'
  | 'outputTokenCostPerK'
  | 'contextTokenCostPerK'
  | 'reasoningMultiplier'
  | 'fixedExtraCost'
  | 'referenceImageFixedCost'
  | 'referenceImageMultiplier'
  | 'videoInputMultiplier'
  | 'audioInputMultiplier';

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
  reasoningMultiplier: number | string;
  referenceImageFixedCost: number | string;
  referenceImageMultiplier: number | string;
  videoInputMultiplier: number | string;
  audioInputMultiplier: number | string;
  isActive: boolean;
};

type BusinessTask = {
  category: 'chat' | 'image' | 'video' | 'prompt';
  taskType: string;
  name: string;
  description: string;
  baseUnit: string;
  defaults: Partial<RuleForm>;
  fields: RuleField[];
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
  reasoningMultiplier: 1,
  referenceImageFixedCost: '',
  referenceImageMultiplier: '',
  videoInputMultiplier: '',
  audioInputMultiplier: '',
  isActive: true,
};

const BUSINESS_TASKS: BusinessTask[] = [
  {
    category: 'chat',
    taskType: 'chat_message_fast',
    name: '快速对话',
    description: '普通聊天中 mini / flash / fast 类模型的单次消息扣费。',
    baseUnit: 'message',
    defaults: { baseCost: 1, modelTier: 'fast', inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_standard',
    name: '普通对话',
    description: '默认普通聊天消息扣费，没有命中特殊档位时使用。',
    baseUnit: 'message',
    defaults: { baseCost: 3, modelTier: 'standard', inputTokenCostPerK: 1, outputTokenCostPerK: 5 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK'],
  },
  {
    category: 'chat',
    taskType: 'chat_message_reasoning',
    name: '深度思考对话',
    description: 'reasoning / thinking / o 系列模型的聊天消息扣费。',
    baseUnit: 'message',
    defaults: { baseCost: 10, modelTier: 'pro_reasoning', inputTokenCostPerK: 3, outputTokenCostPerK: 15, reasoningMultiplier: 1.2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK', 'contextTokenCostPerK', 'reasoningMultiplier'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_low',
    name: '图片工作台 Low',
    description: '图片工作台低质量生成，按生成张数扣费。',
    baseUnit: 'image',
    defaults: { baseCost: 15, quality: 'low' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_medium',
    name: '图片工作台 Medium',
    description: '图片工作台默认质量生成，按生成张数扣费。',
    baseUnit: 'image',
    defaults: { baseCost: 90, quality: 'medium' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'gpt_image_2_high',
    name: '图片工作台 High',
    description: '图片工作台高质量生成，按生成张数扣费。',
    baseUnit: 'image',
    defaults: { baseCost: 350, quality: 'high' },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'image',
    taskType: 'image_generation',
    name: '图片模板生成',
    description: '从图片模板进入生成工作流时使用，按生成张数扣费。',
    baseUnit: 'image',
    defaults: { baseCost: 90 },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'video',
    taskType: 'seedance_fast_720p',
    name: 'Seedance Fast 720p',
    description: '视频工作台 fast 模型 720p 生成，按秒扣费。',
    baseUnit: 'second',
    defaults: { baseCost: 260, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_480p',
    name: 'Seedance 480p',
    description: '视频工作台 480p 生成，按秒扣费。',
    baseUnit: 'second',
    defaults: { baseCost: 160, resolution: '480p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_720p',
    name: 'Seedance 720p',
    description: '视频工作台默认 720p 生成，按秒扣费。',
    baseUnit: 'second',
    defaults: { baseCost: 320, resolution: '720p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'seedance_1080p',
    name: 'Seedance 1080p',
    description: '视频工作台 1080p 生成，按秒扣费。',
    baseUnit: 'second',
    defaults: { baseCost: 800, resolution: '1080p' },
    fields: ['baseCost', 'referenceImageFixedCost', 'videoInputMultiplier', 'audioInputMultiplier'],
  },
  {
    category: 'video',
    taskType: 'video_generation',
    name: '视频模板生成',
    description: '从视频模板进入生成工作流时使用，按模板时长扣费。',
    baseUnit: 'second',
    defaults: { baseCost: 320 },
    fields: ['baseCost', 'referenceImageFixedCost'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_generation',
    name: '图片工作台 Prompt 优化',
    description: '图片工作台点击 AI 优化 Prompt 时使用，按 1 积分 + 输入/输出 token 扣费。',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK'],
  },
  {
    category: 'prompt',
    taskType: 'prompt_optimize_pro',
    name: 'Artifact 文档 AI 优化',
    description: 'Artifact 文档优化流式调用时使用，按 1 积分 + 输入/输出 token 扣费。',
    baseUnit: 'task',
    defaults: { baseCost: 1, inputTokenCostPerK: 0.5, outputTokenCostPerK: 2 },
    fields: ['baseCost', 'inputTokenCostPerK', 'outputTokenCostPerK'],
  },
];

const CATEGORY_LABELS: Record<BusinessTask['category'], string> = {
  chat: '对话',
  image: '图片',
  video: '视频',
  prompt: 'Prompt 优化',
};

const FIELD_META: Record<RuleField, { label: string; type: 'int' | 'number'; hint: string }> = {
  baseCost: { label: '基础积分', type: 'int', hint: '每单位固定扣费。message/task/image 为每次/每张，second 为每秒。' },
  inputTokenCostPerK: { label: '输入 Token / K', type: 'number', hint: '对话和 Prompt 优化任务有效。' },
  outputTokenCostPerK: { label: '输出 Token / K', type: 'number', hint: '对话和 Prompt 优化任务有效。' },
  contextTokenCostPerK: { label: '上下文 Token / K', type: 'number', hint: '仅对聊天任务有效，可留空。' },
  reasoningMultiplier: { label: '推理倍率', type: 'number', hint: '仅对深度思考任务有效。' },
  fixedExtraCost: { label: '固定附加积分', type: 'int', hint: '当前业务任务通常不需要，可留空。' },
  referenceImageFixedCost: { label: '参考图固定积分', type: 'int', hint: '图片/视频带参考图时叠加。' },
  referenceImageMultiplier: { label: '参考图倍率', type: 'number', hint: '图片/视频带参考图时叠乘，可留空。' },
  videoInputMultiplier: { label: '视频输入倍率', type: 'number', hint: '视频任务带参考视频时叠乘，可留空。' },
  audioInputMultiplier: { label: '音频输入倍率', type: 'number', hint: '视频任务带音频输入或生成音频时叠乘，可留空。' },
};

function optionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function toInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function optionalInt(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return toInt(text);
}

function optionalNumber(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return Math.max(0, Number(text) || 0);
}

function taskDefaults(task: BusinessTask): RuleForm {
  return {
    ...EMPTY_RULE,
    taskType: task.taskType,
    name: task.name,
    baseUnit: task.baseUnit,
    ...task.defaults,
  };
}

function ruleToForm(rule: GenerationPricingRule, task?: BusinessTask): RuleForm {
  return {
    ...taskDefaults(task ?? {
      category: 'prompt',
      taskType: rule.taskType,
      name: rule.name,
      description: '',
      baseUnit: rule.baseUnit,
      defaults: {},
      fields: ['baseCost'],
    }),
    id: rule.id,
    taskType: rule.taskType,
    name: rule.name,
    modelProvider: rule.modelProvider ?? '',
    modelName: rule.modelName ?? '',
    quality: rule.quality ?? task?.defaults.quality ?? '',
    resolution: rule.resolution ?? task?.defaults.resolution ?? '',
    modelTier: rule.modelTier ?? task?.defaults.modelTier ?? '',
    baseUnit: rule.baseUnit,
    baseCost: rule.baseCost,
    fixedExtraCost: rule.fixedExtraCost ?? 0,
    inputTokenCostPerK: rule.inputTokenCostPerK ?? '',
    outputTokenCostPerK: rule.outputTokenCostPerK ?? '',
    contextTokenCostPerK: rule.contextTokenCostPerK ?? '',
    reasoningMultiplier: rule.reasoningMultiplier ?? 1,
    referenceImageFixedCost: rule.referenceImageFixedCost ?? '',
    referenceImageMultiplier: rule.referenceImageMultiplier ?? '',
    videoInputMultiplier: rule.videoInputMultiplier ?? '',
    audioInputMultiplier: rule.audioInputMultiplier ?? '',
    isActive: rule.isActive !== false,
  };
}

function sanitizePayload(data: RuleForm, task?: BusinessTask) {
  const fields = new Set(task?.fields ?? ['baseCost']);
  return {
    taskType: task?.taskType ?? String(data.taskType ?? '').trim(),
    name: task?.name ?? String(data.name ?? '').trim(),
    modelProvider: task ? undefined : optionalText(data.modelProvider),
    modelName: task ? undefined : optionalText(data.modelName),
    quality: optionalText(task?.defaults.quality ?? data.quality),
    resolution: optionalText(task?.defaults.resolution ?? data.resolution),
    modelTier: optionalText(task?.defaults.modelTier ?? data.modelTier),
    baseUnit: (task?.baseUnit ?? data.baseUnit) || 'task',
    baseCost: toInt(data.baseCost),
    fixedExtraCost: fields.has('fixedExtraCost') ? toInt(data.fixedExtraCost) : 0,
    inputTokenCostPerK: fields.has('inputTokenCostPerK') ? optionalNumber(data.inputTokenCostPerK) : null,
    outputTokenCostPerK: fields.has('outputTokenCostPerK') ? optionalNumber(data.outputTokenCostPerK) : null,
    contextTokenCostPerK: fields.has('contextTokenCostPerK') ? optionalNumber(data.contextTokenCostPerK) : null,
    reasoningMultiplier: fields.has('reasoningMultiplier') ? optionalNumber(data.reasoningMultiplier) ?? 1 : 1,
    referenceImageFixedCost: fields.has('referenceImageFixedCost') ? optionalInt(data.referenceImageFixedCost) : null,
    referenceImageMultiplier: fields.has('referenceImageMultiplier') ? optionalNumber(data.referenceImageMultiplier) : null,
    videoInputMultiplier: fields.has('videoInputMultiplier') ? optionalNumber(data.videoInputMultiplier) : null,
    audioInputMultiplier: fields.has('audioInputMultiplier') ? optionalNumber(data.audioInputMultiplier) : null,
    isActive: data.isActive !== false,
  };
}

function formatRuleCost(rule: GenerationPricingRule) {
  const extras = [
    rule.inputTokenCostPerK ? `输入 ${rule.inputTokenCostPerK}/K` : '',
    rule.outputTokenCostPerK ? `输出 ${rule.outputTokenCostPerK}/K` : '',
    rule.referenceImageFixedCost ? `参考图 +${rule.referenceImageFixedCost}` : '',
  ].filter(Boolean);
  return extras.length > 0 ? `${rule.baseCost} + ${extras.join(' / ')}` : String(rule.baseCost);
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
  const [previewForm, setPreviewForm] = useState({
    quantity: 1,
    seconds: 5,
    inputTokens: 1000,
    outputTokens: 500,
  });
  const [previewResult, setPreviewResult] = useState<PricingRulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const taskByType = useMemo(
    () => new Map(BUSINESS_TASKS.map((task) => [task.taskType, task])),
    [],
  );
  const rulesByTaskType = useMemo(() => {
    const map = new Map<string, GenerationPricingRule>();
    for (const rule of rules) {
      if (!map.has(rule.taskType)) map.set(rule.taskType, rule);
    }
    return map;
  }, [rules]);
  const customRules = useMemo(
    () => rules.filter((rule) => !taskByType.has(rule.taskType)),
    [rules, taskByType],
  );
  const missingTasks = useMemo(
    () => BUSINESS_TASKS.filter((task) => !rulesByTaskType.has(task.taskType)),
    [rulesByTaskType],
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
      const task = taskByType.get(ruleModal.data.taskType);
      const payload = sanitizePayload(ruleModal.data, task);
      if (ruleModal.mode === 'create') {
        await membershipAdminApi.createPricingRule(payload);
      } else {
        await membershipAdminApi.updatePricingRule(ruleModal.data.id!, payload);
      }
      setRuleModal(null);
      await fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMissingDefaults = async () => {
    if (missingTasks.length === 0) return;
    setSaving(true);
    try {
      for (const task of missingTasks) {
        await membershipAdminApi.createPricingRule(sanitizePayload(taskDefaults(task), task));
      }
      await fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const openRuleModal = (mode: 'create' | 'edit', task?: BusinessTask, rule?: GenerationPricingRule) => {
    if (mode === 'create' && !task) return;
    const selectedTask = task ?? BUSINESS_TASKS[0];
    setRuleModal({
      mode,
      data: rule ? ruleToForm(rule, taskByType.get(rule.taskType)) : taskDefaults(selectedTask),
    });
  };

  const changeModalTask = (taskType: string) => {
    const task = taskByType.get(taskType);
    if (!ruleModal || !task) return;
    setRuleModal({ ...ruleModal, data: taskDefaults(task) });
  };

  const openPreview = (rule: GenerationPricingRule) => {
    setPreviewRule(rule);
    setPreviewResult(null);
    setPreviewError(null);
    setPreviewForm({
      quantity: rule.baseUnit === 'image' ? 1 : 0,
      seconds: rule.baseUnit === 'second' ? 5 : 0,
      inputTokens: rule.inputTokenCostPerK ? 1000 : 0,
      outputTokens: rule.outputTokenCostPerK ? 500 : 0,
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
      if (previewForm.inputTokens > 0) payload.inputTokens = Number(previewForm.inputTokens);
      if (previewForm.outputTokens > 0) payload.outputTokens = Number(previewForm.outputTokens);

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

  const selectedTask = ruleModal ? taskByType.get(ruleModal.data.taskType) : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('adminTaskCosts')}</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>这里维护真实业务任务的扣费规则；缺少规则时，对应业务会直接阻断执行。</p>
        </div>
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="cursor-pointer" disabled={saving || missingTasks.length === 0} onClick={handleCreateMissingDefaults}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />补齐默认规则
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : (
          <div>
            {(['chat', 'image', 'video', 'prompt'] as BusinessTask['category'][]).map((category) => (
              <section key={category}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: category === 'chat' ? 0 : '1px solid var(--border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{CATEGORY_LABELS[category]}任务</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>只展示该类任务实际会用到的计费字段。</p>
                </div>
                <BusinessTaskTable
                  tasks={BUSINESS_TASKS.filter((task) => task.category === category)}
                  rulesByTaskType={rulesByTaskType}
                  onCreate={(task) => openRuleModal('create', task)}
                  onEdit={(rule) => openRuleModal('edit', taskByType.get(rule.taskType), rule)}
                  onPreview={openPreview}
                />
              </section>
            ))}

            {customRules.length > 0 && (
              <section>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>未绑定业务的规则</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>这些规则没有被当前业务代码直接引用，通常不应再新增。</p>
                </div>
                <RulesTable rules={customRules} onPreview={openPreview} onEdit={(rule) => openRuleModal('edit', undefined, rule)} />
              </section>
            )}
          </div>
        )}
      </div>

      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
          <div className="w-full max-w-2xl rounded-lg p-5" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {ruleModal.mode === 'create' ? '新增业务计费规则' : '编辑业务计费规则'}
                </h3>
                {selectedTask && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{selectedTask.description}</p>
                )}
              </div>
              <button className="cursor-pointer p-1" onClick={() => setRuleModal(null)}>
                <X className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
              {ruleModal.mode === 'create' ? (
                <Field label="业务任务">
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    value={ruleModal.data.taskType}
                    onChange={(e) => changeModalTask(e.target.value)}
                  >
                    {BUSINESS_TASKS.map((task) => <option key={task.taskType} value={task.taskType}>{task.name}</option>)}
                  </select>
                </Field>
              ) : (
                <ReadonlyValue label="业务任务" value={selectedTask?.name ?? '未绑定业务规则'} />
              )}
              <ReadonlyValue label="taskType" value={ruleModal.data.taskType} />
              <ReadonlyValue label="计费单位" value={selectedTask?.baseUnit ?? ruleModal.data.baseUnit} />
              <ReadonlyValue label="规格" value={[ruleModal.data.modelTier, ruleModal.data.quality, ruleModal.data.resolution].filter(Boolean).join(' / ') || '通用'} />

              {(selectedTask?.fields ?? ['baseCost']).map((field) => {
                const meta = FIELD_META[field];
                return (
                  <Field key={field} label={meta.label} hint={meta.hint}>
                    <Input
                      type="number"
                      min={0}
                      step={meta.type === 'number' ? '0.1' : '1'}
                      value={ruleModal.data[field]}
                      onChange={(e) => setRuleModal({ ...ruleModal, data: { ...ruleModal.data, [field]: e.target.value } })}
                    />
                  </Field>
                );
              })}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
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
              {previewRule.inputTokenCostPerK && (
                <Field label="输入 Token">
                  <Input type="number" min={0} value={previewForm.inputTokens} onChange={(e) => setPreviewForm({ ...previewForm, inputTokens: Number(e.target.value) })} />
                </Field>
              )}
              {previewRule.outputTokenCostPerK && (
                <Field label="输出 Token">
                  <Input type="number" min={0} value={previewForm.outputTokens} onChange={(e) => setPreviewForm({ ...previewForm, outputTokens: Number(e.target.value) })} />
                </Field>
              )}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <Button size="sm" className="cursor-pointer" disabled={previewing} onClick={runPreview}>
                {previewing ? '诊断中...' : '运行诊断'}
              </Button>
              {previewError && (
                <span className="text-xs" style={{ color: 'var(--danger)' }}>
                  {previewError}
                </span>
              )}
            </div>

            {previewResult && (
              <div className="space-y-4">
                {previewResult.warnings && previewResult.warnings.length > 0 ? (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
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
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--success-soft)', border: '1px solid var(--success-border)', color: 'var(--foreground)' }}>
                    无诊断警告
                  </div>
                )}

                {previewResult.estimateError && (
                  <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-border)', color: 'var(--foreground)' }}>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] leading-4" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </label>
  );
}

function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
      {label}
      <div className="mt-1 h-9 rounded-md border px-3 py-2 font-mono text-xs" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  );
}

function BusinessTaskTable({
  tasks,
  rulesByTaskType,
  onCreate,
  onEdit,
  onPreview,
}: {
  tasks: BusinessTask[];
  rulesByTaskType: Map<string, GenerationPricingRule>;
  onCreate: (task: BusinessTask) => void;
  onEdit: (rule: GenerationPricingRule) => void;
  onPreview: (rule: GenerationPricingRule) => void;
}) {
  const t = useTranslations('membership');

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>业务任务</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>taskType</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>单位</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>当前扣费</th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>状态</th>
          <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--muted)' }}>操作</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const rule = rulesByTaskType.get(task.taskType);
          return (
            <tr key={task.taskType} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="px-4 py-3">
                <div className="font-medium" style={{ color: 'var(--foreground)' }}>{task.name}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{task.description}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{task.taskType}</td>
              <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{task.baseUnit}</td>
              <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{rule ? formatRuleCost(rule) : '-'}</td>
              <td className="px-4 py-3">
                <StatusBadge active={rule?.isActive} missing={!rule} activeText={t('active')} inactiveText={t('inactive')} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  {rule && (
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onPreview(rule)}>
                      <Stethoscope className="mr-1 h-3.5 w-3.5" />预览
                    </Button>
                  )}
                  {rule ? (
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => onEdit(rule)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onCreate(task)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />创建
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
      <tbody>
        {rules.map((rule) => (
          <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{rule.taskType}</td>
            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{rule.name}</td>
            <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{rule.baseUnit}</td>
            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{formatRuleCost(rule)}</td>
            <td className="px-4 py-3">
              <StatusBadge active={rule.isActive} activeText={t('active')} inactiveText={t('inactive')} />
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

function StatusBadge({
  active,
  missing = false,
  activeText,
  inactiveText,
}: {
  active?: boolean;
  missing?: boolean;
  activeText: string;
  inactiveText: string;
}) {
  const label = missing ? '未创建' : active !== false ? activeText : inactiveText;
  const color = missing
    ? 'var(--danger)'
    : active !== false
      ? 'var(--success)'
      : 'var(--muted)';
  const backgroundColor = missing
    ? 'var(--danger-soft)'
    : active !== false
      ? 'var(--success-soft)'
      : 'var(--muted-soft)';

  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor, color }}>
      {label}
    </span>
  );
}
