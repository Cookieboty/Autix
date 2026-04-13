'use client';

import { useEffect, useState } from 'react';
import { Settings, Globe, Plus, Trash2, Edit2, Check, X, ChevronDown } from 'lucide-react';
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
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between flex-shrink-0 h-14 px-8"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" style={{ color: 'var(--muted)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            模型配置
          </span>
          {models.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
            >
              {models.length}
            </span>
          )}
        </div>

        {!showForm && (
          <button
            onClick={() => { setEditing(emptyEditing()); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-foreground)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            新增模型
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── Form ── */}
          {showForm && (
            <div
              className="rounded-xl p-6 space-y-4"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {editing.id ? '编辑模型' : '新增模型'}
                </h3>
                <button
                  onClick={() => { setShowForm(false); setEditing(emptyEditing()); }}
                  className="cursor-pointer p-1 rounded" style={{ color: 'var(--muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="名称">
                  <input
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="例如：GPT-4o"
                  />
                </Field>
                <Field label="供应商">
                  <input
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.provider}
                    onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                    placeholder="openai"
                  />
                </Field>
                <Field label="模型名称">
                  <input
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.model}
                    onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                    placeholder="gpt-4o"
                  />
                </Field>
                <Field label="类型">
                  <Select
                    value={editing.type}
                    onChange={(v) => setEditing({ ...editing, type: v })}
                    options={MODEL_TYPE_OPTIONS}
                  />
                </Field>
                <Field label="优先级">
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.priority}
                    onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="可见性">
                  <Select
                    value={editing.visibility}
                    onChange={(v) => setEditing({ ...editing, visibility: v })}
                    options={['public', 'private']}
                    labels={{ public: '公开', private: '私人' }}
                  />
                </Field>
                <Field label="Base URL">
                  <input
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.baseUrl}
                    onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                    placeholder="https://api.amux.ai/v1（可选）"
                  />
                </Field>
                <Field label="API Key">
                  <input
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.apiKey}
                    onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                    placeholder="sk-...（可选）"
                  />
                </Field>
                <Field label="Temperature">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.metadata.temperature ?? 0.7}
                    onChange={(e) => setEditing({
                      ...editing,
                      metadata: { ...editing.metadata, temperature: parseFloat(e.target.value) || 0 },
                    })}
                  />
                </Field>
                <Field label="Max Tokens">
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none"
                    style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    value={editing.metadata.maxTokens ?? 2048}
                    onChange={(e) => setEditing({
                      ...editing,
                      metadata: { ...editing.metadata, maxTokens: parseInt(e.target.value) || 2048 },
                    })}
                  />
                </Field>
                <Field label="设为默认">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.isDefault}
                      onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>设为默认模型</span>
                  </label>
                </Field>
              </div>

              {/* Capabilities */}
              <Field label="能力标签（可多选）">
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_OPTIONS.map((cap) => (
                    <button
                      key={cap}
                      onClick={() => {
                        const caps = editing.capabilities.includes(cap)
                          ? editing.capabilities.filter((c) => c !== cap)
                          : [...editing.capabilities, cap];
                        setEditing({ ...editing, capabilities: caps });
                      }}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        backgroundColor: editing.capabilities.includes(cap) ? 'var(--accent)' : 'var(--surface)',
                        color: editing.capabilities.includes(cap) ? 'var(--accent-foreground)' : 'var(--muted)',
                        border: `1px solid ${editing.capabilities.includes(cap) ? 'transparent' : 'var(--border)'}`,
                      }}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setShowForm(false); setEditing(emptyEditing()); }}
                  className="px-4 py-1.5 rounded-lg text-sm cursor-pointer"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  取消
                </button>
                <button
                  onClick={() => editing.id ? handleUpdate(editing.id) : handleCreate()}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  {editing.id ? '保存' : '创建'}
                </button>
              </div>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
              ))}
            </div>
          )}

          {/* ── Empty ── */}
          {!loading && models.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Globe className="w-12 h-12 opacity-20" style={{ color: 'var(--muted)' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
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
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg text-sm appearance-none cursor-pointer outline-none"
        style={{ color: 'var(--foreground)', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{(labels ?? {})[o] ?? o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
    </div>
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
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        {title}
      </div>
      <div className="space-y-2">
        {models.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {m.name}
                </span>
                {m.isDefault && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                  >
                    默认
                  </span>
                )}
              </div>
              <div className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
                {m.model} · {m.provider}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {m.capabilities.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--background)', color: 'var(--muted)' }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {deletingId === m.id ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onConfirmDelete(m.id)}
                  className="p-1.5 rounded-lg cursor-pointer"
                  style={{ backgroundColor: 'var(--danger)', color: 'white' }}
                  title="确认删除"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onCancelDelete}
                  className="p-1.5 rounded-lg cursor-pointer"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onEdit(m)}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(m.id)}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
