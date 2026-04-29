'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { ArrowLeft, Plus, Trash2, Send } from 'lucide-react';
import { templateApi, type TemplateVariable } from '@/lib/api';
import { ImageUploader } from '@/components/template/ImageUploader';

export default function TemplateSubmitPage() {
  const router = useRouter();

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

  const CATEGORIES = ['人像', '风景', '产品', '插画', '建筑', '科幻', '场景'];

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
      await templateApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        prompt: prompt.trim(),
        variables: variables.filter((v) => v.key && v.label),
        coverImage,
        exampleImages: exampleImages.filter(Boolean) as string[],
        modelHint: modelHint.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      router.push('/templates');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="ghost" className="cursor-pointer" onPress={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            发布新模板
          </h1>
        </div>

        <div className="space-y-5">
          {/* Title */}
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

          {/* Description */}
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

          {/* Category */}
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

          {/* Prompt */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              Prompt 模板 *
              <span className="ml-2 font-normal" style={{ color: 'var(--muted)' }}>
                {'使用 {{变量名}} 定义可替换变量'}
              </span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={'例: A beautiful portrait of a {{gender}}, {{style}} style, {{background}} background'}
              rows={5}
              className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none font-mono"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>变量定义</label>
              <Button size="sm" variant="ghost" className="cursor-pointer" onPress={addVariable}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 添加变量
              </Button>
            </div>
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
                <button className="p-1 cursor-pointer" onClick={() => removeVariable(i)}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>
            ))}
          </div>

          {/* Cover Image */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>封面图</label>
            <ImageUploader value={coverImage} onChange={setCoverImage} folder="templates" />
          </div>

          {/* Example Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>示例效果图</label>
              <Button size="sm" variant="ghost" className="cursor-pointer" onPress={addExampleSlot}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 添加
              </Button>
            </div>
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
          </div>

          {/* Model Hint */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>推荐模型</label>
            <input
              value={modelHint}
              onChange={(e) => setModelHint(e.target.value)}
              placeholder="dall-e-3"
              className="w-full h-9 px-3 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>标签</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="用逗号分隔，如: 写真, 女性, 户外"
              className="w-full h-9 px-3 text-sm rounded-md outline-none"
              style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 pb-10">
          <Button variant="ghost" className="cursor-pointer" onPress={() => router.back()}>
            取消
          </Button>
          <Button
            variant="primary"
            className="cursor-pointer"
            isDisabled={submitting || !title.trim() || !prompt.trim()}
            onPress={handleSubmit}
          >
            <Send className="w-4 h-4 mr-1" /> {submitting ? '提交中...' : '提交审核'}
          </Button>
        </div>
      </div>
    </div>
  );
}
