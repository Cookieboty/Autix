'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, FileText, RefreshCw, Save } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  toast,
} from '@autix/shared-ui/ui';
import {
  systemPromptsApi,
  type SystemPromptInput,
  type SystemPromptItem,
} from '@/lib/api';

type PromptForm = SystemPromptInput & { id?: string };

function formFromPrompt(prompt: SystemPromptItem, nextVersion?: string): PromptForm {
  return {
    id: prompt.source === 'database' && prompt.status === 'draft' ? prompt.id : undefined,
    key: prompt.key,
    name: prompt.name,
    description: prompt.description ?? '',
    version: nextVersion ?? prompt.version,
    content: prompt.content,
    variables: prompt.variables,
  };
}

function nextPatchVersion(version: string) {
  const parts = version.split('.').map((part) => Number(part));
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
  return `${version}-draft`;
}

function variableText(value: string[] | undefined) {
  return (value ?? []).join(', ');
}

function parseVariables(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminSystemPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromptForm | null>(null);
  const [variableInput, setVariableInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, SystemPromptItem[]>();
    for (const prompt of prompts) {
      map.set(prompt.key, [...(map.get(prompt.key) ?? []), prompt]);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      active: items.find((item) => item.status === 'active'),
      items: items.sort((a, b) => {
        const statusOrder = { active: 0, draft: 1, archived: 2 };
        const byStatus = statusOrder[a.status] - statusOrder[b.status];
        if (byStatus !== 0) return byStatus;
        return b.version.localeCompare(a.version);
      }),
    }));
  }, [prompts]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemPromptsApi.list();
      setPrompts(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.msg ?? err?.message ?? '加载系统 Prompt 失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openDraft = (prompt: SystemPromptItem) => {
    const draft = formFromPrompt(
      prompt,
      prompt.source === 'default' || prompt.status !== 'draft'
        ? nextPatchVersion(prompt.version)
        : undefined,
    );
    setForm(draft);
    setVariableInput(variableText(draft.variables));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        variables: parseVariables(variableInput),
      };
      if (form.id) {
        await systemPromptsApi.update(form.id, payload);
      } else {
        await systemPromptsApi.create(payload);
      }
      setForm(null);
      await load();
      toast.success('Prompt 草稿已保存');
    } catch (err: any) {
      const message = err?.response?.data?.msg ?? err?.message ?? '保存失败';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const publish = async (prompt: SystemPromptItem) => {
    if (prompt.source !== 'database') return;
    setPublishingId(prompt.id);
    setError(null);
    try {
      await systemPromptsApi.publish(prompt.id);
      await load();
      toast.success(`${prompt.key}@${prompt.version} 已发布`);
    } catch (err: any) {
      const message = err?.response?.data?.msg ?? err?.message ?? '发布失败';
      setError(message);
      toast.error(message);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <h1 className="text-foreground text-lg font-semibold">系统 Prompt</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            集中管理默认提示词、变量、版本和发布状态。
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-5">
        {loading ? (
          <div className="text-muted-foreground text-sm">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {grouped.map((group) => (
              <Card key={group.key} className="rounded-lg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        {group.active?.name ?? group.key}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {group.active?.description ?? '暂无描述'}
                      </CardDescription>
                    </div>
                    {group.active && (
                      <Badge variant={group.active.source === 'default' ? 'outline' : 'secondary'}>
                        {group.active.source === 'default' ? '默认' : `v${group.active.version}`}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.items.map((prompt) => (
                      <div
                        key={prompt.id}
                        className="border-border bg-background rounded-md border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs">{prompt.key}</span>
                            <Badge variant={prompt.status === 'active' ? 'secondary' : 'outline'}>
                              {prompt.status}
                            </Badge>
                            <Badge variant="outline">v{prompt.version}</Badge>
                            <Badge variant="outline">{prompt.source}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openDraft(prompt)}>
                              <Copy className="h-3.5 w-3.5" />
                              {prompt.status === 'draft' ? '编辑' : '复制为新版本'}
                            </Button>
                            {prompt.source === 'database' && prompt.status !== 'active' && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => publish(prompt)}
                                disabled={publishingId === prompt.id}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                发布
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5">
                          {prompt.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
          <SheetHeader className="px-6">
            <SheetTitle>{form?.id ? '编辑 Prompt 草稿' : '创建 Prompt 版本'}</SheetTitle>
            <SheetDescription>保存为草稿后再发布，发布后会替换同 key 的当前 active 版本。</SheetDescription>
          </SheetHeader>

          {form && (
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input value={form.key} disabled={!!form.id} onChange={(event) => setForm({ ...form, key: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>版本</Label>
                  <Input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>名称</Label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Input value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>变量</Label>
                <Input
                  value={variableInput}
                  placeholder="language, appName, candidateList"
                  onChange={(event) => setVariableInput(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Prompt 内容</Label>
                <Textarea
                  className="min-h-[360px] font-mono text-xs leading-5"
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                />
              </div>
            </div>
          )}

          <SheetFooter className="flex-row justify-end gap-2 border-t px-6">
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              取消
            </Button>
            <Button type="button" onClick={save} disabled={saving || !form}>
              <Save className="h-3.5 w-3.5" />
              {saving ? '保存中...' : '保存草稿'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
