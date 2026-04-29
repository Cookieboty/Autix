'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { Plus, Trash2, Send, Save } from 'lucide-react';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerSection,
  DrawerFooterRow,
} from '@/components/drawer-shell';
import { templateApi, type TemplateVariable, type PromptTemplate } from '@/lib/api';
import { ImageUploader } from './ImageUploader';

const CATEGORIES = ['人像', '风景', '产品', '插画', '建筑', '科幻', '场景'];

interface TemplateFormDrawerProps {
  open: boolean;
  onClose: () => void;
  template?: PromptTemplate | null;
  onSaved?: () => void;
}

export function TemplateFormDrawer({ open, onClose, template, onSaved }: TemplateFormDrawerProps) {
  const isEdit = !!template;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('人像');
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [exampleImages, setExampleImages] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? '');
      setCategory(template.category);
      setPrompt(template.prompt);
      setModelHint(template.modelHint ?? '');
      setTags(template.tags.join(', '));
      setCoverImage(template.coverImage);
      setExampleImages(template.exampleImages.length > 0 ? [...template.exampleImages] : []);
      setVariables(template.variables ?? []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('人像');
      setPrompt('');
      setModelHint('');
      setTags('');
      setCoverImage(undefined);
      setExampleImages([]);
      setVariables([]);
    }
  }, [open, template]);

  const addVariable = () => {
    setVariables([...variables, { key: '', label: '', type: 'text' }]);
  };
  const removeVariable = (i: number) => {
    setVariables(variables.filter((_, idx) => idx !== i));
  };
  const updateVariable = (i: number, field: keyof TemplateVariable, value: string) => {
    const copy = [...variables];
    (copy[i] as any)[field] = value;
    setVariables(copy);
  };

  const addExampleSlot = () => setExampleImages([...exampleImages, undefined]);

  const handleSubmit = async () => {
    if (!title.trim() || !prompt.trim() || !category) return;
    setSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        prompt: prompt.trim(),
        variables: variables.filter((v) => v.key && v.label),
        coverImage,
        exampleImages: exampleImages.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      if (isEdit && template) {
        await templateApi.update(template.id, data);
      } else {
        await templateApi.create(data);
      }
      onSaved?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      width="2xl"
      header={
        <DrawerHero
          eyebrow="模板"
          title={isEdit ? '编辑模板' : '发布新模板'}
          description={isEdit ? '修改模板内容后将重新进入审核' : '创建一个新的 Prompt 模板，提交后将由管理员审核'}
        />
      }
      footer={
        <DrawerFooterRow
          aside={!isEdit ? '提交后需管理员审核通过才能发布' : '保存后将重新进入待审核状态'}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="cursor-pointer" onPress={onClose}>
                取消
              </Button>
              <Button
                variant="primary"
                className="cursor-pointer"
                isDisabled={submitting || !title.trim() || !prompt.trim()}
                onPress={handleSubmit}
              >
                {isEdit ? <Save className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {submitting ? '处理中...' : isEdit ? '保存' : '提交审核'}
              </Button>
            </div>
          }
        />
      }
    >
      <DrawerBody>
        <DrawerSection title="基本信息">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>标题 *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="给你的模板起个名字"
                className="w-full h-10 px-3 text-sm rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述这个模板的用途和效果"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>分类 *</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: category === cat ? 'var(--accent)' : 'var(--panel-muted)',
                      color: category === cat ? '#fff' : 'var(--muted)',
                    }}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DrawerSection>

        <DrawerSection
          title="Prompt 模板"
          description="使用 {{变量名}} 定义可替换变量"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例: A beautiful portrait of a {{gender}}, {{style}} style, {{background}} background"
            rows={6}
            className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none font-mono"
            style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
          />
        </DrawerSection>

        <DrawerSection title="变量定义">
          <div className="space-y-2">
            {variables.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={v.key}
                  onChange={(e) => updateVariable(i, 'key', e.target.value)}
                  placeholder="变量名"
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none font-mono"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
                <input
                  value={v.label}
                  onChange={(e) => updateVariable(i, 'label', e.target.value)}
                  placeholder="显示标签"
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
                <select
                  value={v.type}
                  onChange={(e) => updateVariable(i, 'type', e.target.value)}
                  className="w-24 h-8 px-2 text-xs rounded-md outline-none"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                >
                  <option value="text">文本</option>
                  <option value="select">下拉</option>
                  <option value="number">数字</option>
                </select>
                <input
                  value={v.default ?? ''}
                  onChange={(e) => updateVariable(i, 'default', e.target.value)}
                  placeholder="默认值"
                  className="flex-1 h-8 px-2 text-xs rounded-md outline-none"
                  style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                />
                <button className="p-1 cursor-pointer" onClick={() => removeVariable(i)}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="cursor-pointer" onPress={addVariable}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 添加变量
            </Button>
          </div>
        </DrawerSection>

        <DrawerSection title="图片">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>封面图</label>
              <ImageUploader value={coverImage} onChange={setCoverImage} folder="templates" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>示例效果图</label>
                <Button size="sm" variant="ghost" className="cursor-pointer" onPress={addExampleSlot}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> 添加
                </Button>
              </div>
              {exampleImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {exampleImages.map((img, i) => (
                    <ImageUploader
                      key={i}
                      value={img}
                      onChange={(url) => {
                        const copy = [...exampleImages];
                        copy[i] = url;
                        setExampleImages(copy);
                      }}
                      folder="templates"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="其他">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>推荐模型</label>
              <input
                value={modelHint}
                onChange={(e) => setModelHint(e.target.value)}
                placeholder="gpt-image-1"
                className="w-full h-9 px-3 text-sm rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>标签</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="逗号分隔，如: 写真, 女性, 户外"
                className="w-full h-9 px-3 text-sm rounded-md outline-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
            </div>
          </div>
        </DrawerSection>
      </DrawerBody>
    </DrawerShell>
  );
}
