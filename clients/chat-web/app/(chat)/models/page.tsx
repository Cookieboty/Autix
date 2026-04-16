'use client';

import { useEffect, useState } from 'react';
import { Settings, Globe, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import {
  Input,
  Button,
  Checkbox,
  Select,
  ListBox,
  Label,
  TextField,
} from '@heroui/react';
import {
  getAvailableModels,
  deleteModel as deleteModelApi,
  createModel as createModelApi,
  updateModel as updateModelApi,
  chatApi,
  type ModelConfigItem,
} from '@/lib/api';

// 推荐的 capabilities 选项
const CAPABILITY_OPTIONS = ['text', 'vision', 'voice', 'speech', 'code', 'reasoning', 'image', 'embedding'];

// 模型类型选项
const MODEL_TYPE_OPTIONS = ['general', 'code', 'intent', 'embedding'];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'private', label: '私人' },
];

interface EditingModel {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  visibility: string;
  capabilities: string[];
  baseUrl: string;
  apiKey: string;
  metadata: { temperature?: number; maxTokens?: number };
}

function emptyEditing(): EditingModel {
  return {
    name: '',
    model: '',
    provider: 'openai',
    type: 'general',
    priority: 0,
    isDefault: false,
    visibility: 'private',
    capabilities: ['text'],
    baseUrl: 'https://api.amux.ai/v1',
    apiKey: '',
    metadata: { temperature: 0.7, maxTokens: 2048 },
  };
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EditingModel>(emptyEditing());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadModels = () => {
    setLoading(true);
    getAvailableModels()
      .then(({ data }) => setModels(data as ModelConfigItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleCreate = async () => {
    try {
      await createModelApi({
        name: editing.name,
        model: editing.model,
        provider: editing.provider,
        type: editing.type as any,
        priority: editing.priority,
        isDefault: editing.isDefault,
        visibility: editing.visibility as any,
        capabilities: editing.capabilities,
        baseUrl: editing.baseUrl || undefined,
        apiKey: editing.apiKey || undefined,
        metadata: editing.metadata,
      } as any);
      setShowForm(false);
      setEditing(emptyEditing());
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateModelApi(id, {
        name: editing.name,
        model: editing.model,
        provider: editing.provider,
        type: editing.type as any,
        priority: editing.priority,
        isDefault: editing.isDefault,
        visibility: editing.visibility as any,
        capabilities: editing.capabilities,
        baseUrl: editing.baseUrl || undefined,
        apiKey: editing.apiKey || undefined,
        metadata: editing.metadata,
      } as any);
      setEditing(emptyEditing());
      setShowForm(false);
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModelApi(id);
      setDeletingId(null);
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (m: ModelConfigItem) => {
    setEditing({
      id: m.id,
      name: m.name,
      model: m.model,
      provider: m.provider,
      type: m.type,
      priority: m.priority,
      isDefault: m.isDefault,
      visibility: m.visibility,
      capabilities: m.capabilities,
      baseUrl: (m.metadata as any)?.baseUrl ?? '',
      apiKey: (m.metadata as any)?.apiKey ?? '',
      metadata: {
        temperature: (m.metadata as any)?.temperature ?? 0.7,
        maxTokens: (m.metadata as any)?.maxTokens ?? 2048,
      },
    });
    setShowForm(true);
  };

  const privateModels = models.filter((m) => m.visibility === 'private');
  const publicModels = models.filter((m) => m.visibility === 'public');

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0 h-14 px-8 border-b border-default">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-foreground/50" />
          <span className="text-sm font-semibold text-foreground">
            模型配置
          </span>
          {models.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-default-100 text-foreground/50">
              {models.length}
            </span>
          )}
        </div>

        {!showForm && (
          <Button
            variant="primary"
            size="sm"
            onPress={() => { setEditing(emptyEditing()); setShowForm(true); }}
          >
            <Plus className="w-3.5 h-3.5" />
            新增模型
          </Button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── Form ── */}
          {showForm && (
            <div className="rounded-xl p-6 space-y-5 bg-default-50 border border-default">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {editing.id ? '编辑模型' : '新增模型'}
                </h3>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => { setShowForm(false); setEditing(emptyEditing()); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="名称">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="例如：GPT-4o"
                  />
                </Field>
                <Field label="供应商">
                  <Input
                    value={editing.provider}
                    onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                    placeholder="openai"
                  />
                </Field>
                <Field label="模型名称">
                  <Input
                    value={editing.model}
                    onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                    placeholder="gpt-4o"
                  />
                </Field>
                <Field label="类型">
                  <HeroSelect
                    value={editing.type}
                    onChange={(v) => setEditing({ ...editing, type: v })}
                    options={MODEL_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
                  />
                </Field>
                <Field label="优先级">
                  <Input
                    type="number"
                    value={String(editing.priority)}
                    onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="可见性">
                  <HeroSelect
                    value={editing.visibility}
                    onChange={(v) => setEditing({ ...editing, visibility: v })}
                    options={VISIBILITY_OPTIONS}
                  />
                </Field>
                <Field label="Base URL">
                  <Input
                    value={editing.baseUrl}
                    onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                    placeholder="https://api.amux.ai/v1（可选）"
                  />
                </Field>
                <Field label="API Key">
                  <Input
                    value={editing.apiKey}
                    onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                    placeholder="sk-...（可选）"
                  />
                </Field>
                <Field label="Temperature">
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    max={2}
                    value={String(editing.metadata.temperature ?? 0.7)}
                    onChange={(e) => setEditing({
                      ...editing,
                      metadata: { ...editing.metadata, temperature: parseFloat(e.target.value) || 0 },
                    })}
                  />
                </Field>
                <Field label="Max Tokens">
                  <Input
                    type="number"
                    value={String(editing.metadata.maxTokens ?? 2048)}
                    onChange={(e) => setEditing({
                      ...editing,
                      metadata: { ...editing.metadata, maxTokens: parseInt(e.target.value) || 2048 },
                    })}
                  />
                </Field>
                <Field label="设为默认">
                  <Checkbox
                    isSelected={editing.isDefault}
                    onChange={(checked: boolean) => setEditing({ ...editing, isDefault: checked })}
                  >
                    设为默认模型
                  </Checkbox>
                </Field>
              </div>

              {/* Capabilities */}
              <Field label="能力标签">
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_OPTIONS.map((cap) => (
                    <Button
                      key={cap}
                      size="sm"
                      variant={editing.capabilities.includes(cap) ? 'primary' : 'ghost'}
                      onPress={() => {
                        const caps = editing.capabilities.includes(cap)
                          ? editing.capabilities.filter((c) => c !== cap)
                          : [...editing.capabilities, cap];
                        setEditing({ ...editing, capabilities: caps });
                      }}
                      className="text-xs"
                    >
                      {cap}
                    </Button>
                  ))}
                </div>
              </Field>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => { setShowForm(false); setEditing(emptyEditing()); }}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onPress={() => editing.id ? handleUpdate(editing.id) : handleCreate()}
                >
                  {editing.id ? '保存' : '创建'}
                </Button>
              </div>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse bg-default-100" />
              ))}
            </div>
          )}

          {/* ── Empty ── */}
          {!loading && models.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Globe className="w-12 h-12 opacity-20 text-foreground/50" />
              <p className="text-sm text-foreground/50">
                还没有配置模型，点击上方按钮添加
              </p>
            </div>
          )}

          {/* ── Private Models ── */}
          {!loading && privateModels.length > 0 && (
            <ModelSection
              title="私人模型"
              models={privateModels}
              onEdit={startEdit}
              onDelete={(id) => setDeletingId(id)}
              deletingId={deletingId}
              onConfirmDelete={handleDelete}
              onCancelDelete={() => setDeletingId(null)}
            />
          )}

          {/* ── Public Models ── */}
          {!loading && publicModels.length > 0 && (
            <ModelSection
              title="公开模型"
              models={publicModels}
              onEdit={startEdit}
              onDelete={(id) => setDeletingId(id)}
              deletingId={deletingId}
              onConfirmDelete={handleDelete}
              onCancelDelete={() => setDeletingId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub components ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-20 shrink-0 text-xs font-medium text-foreground/60">{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function HeroSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      placeholder="请选择"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
              {opt.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function ModelSection({
  title,
  models,
  onEdit,
  onDelete,
  deletingId,
  onConfirmDelete,
  onCancelDelete,
}: {
  title: string;
  models: ModelConfigItem[];
  onEdit: (m: ModelConfigItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
        {title}
      </div>
      <div className="space-y-2">
        {models.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors bg-default-50 border border-default"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate text-foreground">
                  {m.name}
                </span>
                {m.isDefault && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 bg-primary text-primary-foreground">
                    默认
                  </span>
                )}
              </div>
              <div className="text-xs truncate mt-0.5 text-foreground/50">
                {m.model} · {m.provider}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {m.capabilities.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-default-100 text-foreground/50"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {deletingId === m.id ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  isIconOnly
                  size="sm"
                  variant="primary"
                  className="bg-danger text-white"
                  onPress={() => onConfirmDelete(m.id)}
                  aria-label="确认删除"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={onCancelDelete}
                  aria-label="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => onEdit(m)}
                  aria-label="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="hover:text-danger"
                  onPress={() => onDelete(m.id)}
                  aria-label="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
