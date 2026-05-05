'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@autix/shared-ui';
import { ArrowLeft, Send, ImagePlus, RefreshCw, ChevronDown, Pencil, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useImageGenerationStore } from '@autix/shared-store';
import { imageGenApi, imageGenerationApi, getAvailableModels, appendConversationMessage, type TemplateVariable, type ModelConfigItem } from '@/lib/api';
import { ImageUploader } from '@/components/template/ImageUploader';
import { FallbackImage } from '@/components/template/FallbackImage';

const FALLBACK_MODELS = [
  'gpt-image-2',
  'gpt-image-1',
  'dall-e-3',
  'dall-e-2',
  'flux-pro',
  'flux-dev',
  'stable-diffusion-xl',
  'midjourney',
];

export default function WorkspacePage() {
  const tWs = useTranslations('templateWorkspace');
  const tCommon = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversationId');
  const {
    currentGeneration: gen,
    fetchGeneration,
    setCurrentGeneration,
    generating,
    setGenerating,
  } = useImageGenerationStore();

  const [chatInput, setChatInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | undefined>();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [editingModel, setEditingModel] = useState(false);
  const [modelInput, setModelInput] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [imageModels, setImageModels] = useState<ModelConfigItem[]>([]);

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptInput, setPromptInput] = useState('');

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const templateVarDefs: TemplateVariable[] = (gen as any)?.template?.variables ?? [];
  const templatePrompt: string = (gen as any)?.template?.prompt ?? '';

  const resolvePrompt = useCallback((template: string, vars: Record<string, string>) => {
    let resolved = template;
    for (const [key, value] of Object.entries(vars)) {
      resolved = resolved.replaceAll(`{{${key}}}`, value);
    }
    return resolved;
  }, []);

  useEffect(() => {
    if (id) fetchGeneration(id);
  }, [id]);

  useEffect(() => {
    getAvailableModels()
      .then(({ data }) => {
        const all = (data as ModelConfigItem[]) ?? [];
        setImageModels(all.filter((m) => m.capabilities.includes('image')));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gen?.turns]);

  useEffect(() => {
    if (gen) {
      setModelInput(gen.modelUsed);
      setPromptInput(gen.resolvedPrompt);
      if (gen.variables) {
        setVariableValues(gen.variables);
      }
    }
  }, [gen?.id]);

  const currentModel = modelInput || gen?.modelUsed || 'gpt-image-2';
  const currentPrompt = promptInput || gen?.resolvedPrompt || '';

  const handleVariableChange = (key: string, value: string) => {
    const updated = { ...variableValues, [key]: value };
    setVariableValues(updated);
    if (templatePrompt) {
      const newPrompt = resolvePrompt(templatePrompt, updated);
      setPromptInput(newPrompt);
      if (gen) {
        setCurrentGeneration({ ...gen, resolvedPrompt: newPrompt, variables: updated });
      }
    }
  };

  const handleModelSelect = (model: string) => {
    setModelInput(model);
    setShowModelDropdown(false);
    setEditingModel(false);
    if (gen) {
      setCurrentGeneration({ ...gen, modelUsed: model });
    }
  };

  const handlePromptSave = () => {
    setEditingPrompt(false);
    if (gen && promptInput !== gen.resolvedPrompt) {
      setCurrentGeneration({ ...gen, resolvedPrompt: promptInput });
    }
  };

  const resolveAmuxConfig = useCallback(() => {
    const matched = imageModels.find((m) => m.model === currentModel);
    if (matched) {
      const meta = matched.metadata as Record<string, any> | undefined;
      const baseUrl = meta?.baseUrl;
      const apiKey = meta?.apiKey;
      if (baseUrl && apiKey) return { baseUrl, apiKey };
    }
    return null;
  }, [imageModels, currentModel]);

  const handleGenerate = async () => {
    const config = resolveAmuxConfig();
    if (!config || !gen) return;

    setGenerating(true);
    try {
      const res = await imageGenApi.generate(
        {
          model: currentModel,
          prompt: currentPrompt,
          n: 4,
          response_format: 'b64_json',
        },
        config,
      );
      const data = res.data as any;
      const imageUrls: string[] = [];
      if (data?.data) {
        for (const item of data.data) {
          if (item.b64_json) {
            imageUrls.push(`data:image/png;base64,${item.b64_json}`);
          } else if (item.url) {
            imageUrls.push(item.url);
          }
        }
      }

      setCurrentGeneration({
        ...gen,
        modelUsed: currentModel,
        resolvedPrompt: currentPrompt,
        generatedImages: imageUrls,
        status: 'completed',
      });
    } catch (err: any) {
      setCurrentGeneration({
        ...gen,
        status: 'error',
        error: err?.message ?? 'Generation failed',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendRefine = async () => {
    const config = resolveAmuxConfig();
    if (!chatInput.trim() || !gen || !config) return;

    const userContent = chatInput.trim();
    setChatInput('');
    const userImgs = attachedImage ? [attachedImage] : [];
    setAttachedImage(undefined);

    await imageGenerationApi.addTurn(gen.id, {
      role: 'USER',
      content: userContent,
      images: userImgs,
    });

    setGenerating(true);
    try {
      const messages: any[] = [
        {
          role: 'system',
          content: `You are an expert image prompt engineer. The user wants to refine an image. The current prompt is:\n\n${currentPrompt}\n\nBased on the user's modification request, output ONLY the improved prompt text, nothing else.`,
        },
      ];

      if (gen.generatedImages.length > 0) {
        const lastImg = gen.generatedImages[gen.generatedImages.length - 1];
        messages.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: lastImg } },
            { type: 'text', text: userContent },
          ],
        });
      } else {
        messages.push({ role: 'user', content: userContent });
      }

      const chatRes = await imageGenApi.chat(
        { model: 'gpt-4o', messages, stream: false },
        config,
      );
      const chatData = chatRes.data as any;
      const newPrompt = chatData?.choices?.[0]?.message?.content ?? currentPrompt;

      setPromptInput(newPrompt);

      await imageGenerationApi.addTurn(gen.id, {
        role: 'ASSISTANT',
        content: `${tWs('refinedPromptPrefix')}\n${newPrompt}`,
      });

      const imgRes = await imageGenApi.generate(
        { model: currentModel, prompt: newPrompt, n: 4, response_format: 'b64_json' },
        config,
      );
      const imgData = imgRes.data as any;
      const newImages: string[] = [];
      if (imgData?.data) {
        for (const item of imgData.data) {
          if (item.b64_json) newImages.push(`data:image/png;base64,${item.b64_json}`);
          else if (item.url) newImages.push(item.url);
        }
      }

      await imageGenerationApi.addTurn(gen.id, {
        role: 'ASSISTANT',
        content: tWs('regeneratedMessage'),
        images: newImages,
      });

      await fetchGeneration(gen.id);
    } catch (err: any) {
      await imageGenerationApi.addTurn(gen.id, {
        role: 'ASSISTANT',
        content: `${tWs('generationFailed')}: ${err?.message ?? 'Unknown error'}`,
      });
      await fetchGeneration(gen.id);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendToConversation = async () => {
    if (!conversationId || !gen || gen.generatedImages.length === 0) return;
    const images = gen.generatedImages.map((src, i) => `![生成图 ${i + 1}](${src})`).join('\n');
    await appendConversationMessage(conversationId, {
      role: 'USER',
      content: `我用图片模板生成了结果，继续基于这些内容讨论。\n\n提示词：${gen.resolvedPrompt}\n\n${images}`,
      metadata: {
        source: 'image_template_generation',
        generationId: gen.id,
        templateId: gen.templateId,
        images: gen.generatedImages,
      },
    });
    router.push(`/c/${conversationId}`);
  };

  if (!gen) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
      </div>
    );
  }

  const hasTurns = (gen.turns?.length ?? 0) > 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Info panel */}
      <aside
        className="w-[300px] flex-shrink-0 overflow-y-auto p-4 space-y-4"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <Button
          variant="ghost"
          className="cursor-pointer"
          onClick={() => router.push(`/marketplace/image-templates/${gen.templateId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {tWs('backToDetail')}
        </Button>

        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>{tWs('templateLabel')}</p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {(gen as any).template?.title ?? gen.templateId}
          </p>
        </div>

        {/* Model selector */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>{tWs('modelLabel')}</p>
          <div className="relative">
            <button
              className="w-full flex items-center justify-between h-9 px-3 text-sm rounded-md cursor-pointer"
              style={{
                border: '1px solid var(--input-border)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--foreground)',
              }}
              onClick={() => setShowModelDropdown(!showModelDropdown)}
            >
              <span className="truncate">{currentModel}</span>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            </button>

            {showModelDropdown && (
              <div
                className="absolute z-10 mt-1 w-full rounded-md overflow-hidden shadow-lg"
                style={{
                  backgroundColor: 'var(--panel)',
                  border: '1px solid var(--border)',
                }}
              >
                {(imageModels.length > 0
                  ? imageModels.map((m) => m.model)
                  : FALLBACK_MODELS
                ).map((m) => (
                  <button
                    key={m}
                    className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer flex items-center justify-between"
                    style={{ color: m === currentModel ? 'var(--accent)' : 'var(--foreground)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--panel-muted)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    onClick={() => handleModelSelect(m)}
                  >
                    <span>{m}</span>
                    {m === currentModel && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
                <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <input
                    value={editingModel ? modelInput : ''}
                    onChange={(e) => { setEditingModel(true); setModelInput(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && modelInput.trim()) {
                        handleModelSelect(modelInput.trim());
                      }
                    }}
                    placeholder={tWs('customModelPlaceholder')}
                    className="w-full h-7 px-2 text-xs rounded outline-none"
                    style={{
                      border: '1px solid var(--input-border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prompt editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{tWs('currentPrompt')}</p>
            <button
              className="p-1 rounded cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onClick={() => {
                if (editingPrompt) {
                  handlePromptSave();
                } else {
                  setPromptInput(currentPrompt);
                  setEditingPrompt(true);
                }
              }}
            >
              {editingPrompt
                ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                : <Pencil className="w-3.5 h-3.5" />
              }
            </button>
          </div>
          {editingPrompt ? (
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-md text-xs leading-5 outline-none resize-none"
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--foreground)',
                fontFamily: 'monospace',
                border: '1px solid var(--accent)',
              }}
              onBlur={handlePromptSave}
            />
          ) : (
            <div
              className="p-3 rounded-md text-xs leading-5 cursor-pointer"
              style={{
                backgroundColor: 'var(--panel-muted)',
                color: 'var(--foreground)',
                fontFamily: 'monospace',
                border: '1px solid var(--border)',
              }}
              onClick={() => {
                setPromptInput(currentPrompt);
                setEditingPrompt(true);
              }}
            >
              {currentPrompt}
            </div>
          )}
        </div>

        {templateVarDefs.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>{tWs('variablesLabel')}</p>
            <div className="space-y-2.5">
              {templateVarDefs.map((varDef) => {
                const value = variableValues[varDef.key] ?? varDef.default ?? '';
                return (
                  <div key={varDef.key} className="space-y-1">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                      {varDef.label}
                      <span className="ml-1 font-mono opacity-60">{`{{${varDef.key}}}`}</span>
                    </label>
                    {varDef.type === 'select' && varDef.options?.length ? (
                      <select
                        value={value}
                        onChange={(e) => handleVariableChange(varDef.key, e.target.value)}
                        className="w-full h-8 px-2 text-xs rounded-md outline-none cursor-pointer"
                        style={{
                          border: '1px solid var(--input-border)',
                          backgroundColor: 'var(--input-bg)',
                          color: 'var(--foreground)',
                        }}
                      >
                        {varDef.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={value}
                        onChange={(e) => handleVariableChange(varDef.key, e.target.value)}
                        placeholder={varDef.default}
                        className="w-full h-8 px-2 text-xs rounded-md outline-none"
                        style={{
                          border: '1px solid var(--input-border)',
                          backgroundColor: 'var(--input-bg)',
                          color: 'var(--foreground)',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </aside>

      {/* Main: Generated images + Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Generated images */}
          {gen.generatedImages.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {tWs('generateResults')}
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                    {currentModel}
                  </span>
                </h2>
                <div className="flex gap-2">
                  {conversationId && (
                    <Button variant="outline" size="sm" className="cursor-pointer" onClick={handleSendToConversation}>
                      <Send className="w-3.5 h-3.5 mr-1" /> 发送到当前会话
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={handleGenerate}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> {tWs('regenerate')}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {gen.generatedImages.map((imgSrc, i) => (
                  <FallbackImage
                    key={i}
                    src={imgSrc}
                    alt={tWs('generatedNumber', { n: i + 1 })}
                    className="w-full rounded-lg object-cover aspect-square"
                    style={{ border: '1px solid var(--border)' }}
                    fallbackText={tWs('imageNumber', { n: i + 1 })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-64 rounded-lg gap-4"
              style={{ border: '2px dashed var(--border)', backgroundColor: 'var(--panel-muted)' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {generating ? tWs('generating') : tWs('clickToGenerate')}
              </p>
              {!generating && (
                <Button  className="cursor-pointer" onClick={handleGenerate}>
                  {tWs('generateNow')}
                </Button>
              )}
            </div>
          )}

          {/* Chat turns */}
          {hasTurns && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{tWs('multiTurnRefine')}</h2>
              {gen.turns!.map((turn) => (
                <div
                  key={turn.id}
                  className="p-3 rounded-lg space-y-2"
                  style={{
                    backgroundColor: turn.role === 'USER' ? 'transparent' : 'var(--panel-muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: turn.role === 'USER' ? 'var(--accent)' : 'var(--panel-muted)',
                        color: turn.role === 'USER' ? '#fff' : 'var(--foreground)',
                      }}
                    >
                      {turn.role === 'USER' ? tWs('you') : tWs('ai')}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {new Date(turn.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                    {turn.content}
                  </p>
                  {turn.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {turn.images.map((imgSrc, i) => (
                        <FallbackImage
                          key={i}
                          src={imgSrc}
                          alt=""
                          className="w-full rounded object-cover aspect-square"
                          fallbackText=""
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Chat input */}
        {gen.generatedImages.length > 0 && (
          <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid var(--border)' }}>
            {attachedImage && (
              <div className="mb-2">
                <ImageUploader value={attachedImage} onChange={setAttachedImage} folder="references" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-md cursor-pointer"
                style={{ color: 'var(--muted)' }}
                onClick={() => setAttachedImage(attachedImage ? undefined : '')}
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendRefine()}
                placeholder={tWs('refinePlaceholder')}
                className="flex-1 h-10 px-3 text-sm rounded-lg outline-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
                disabled={generating}
              />
              <Button
                
                className="cursor-pointer"
                disabled={generating || !chatInput.trim()}
                onClick={handleSendRefine}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
