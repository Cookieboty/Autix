'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, FileText, Globe, ImagePlus, Lock, SlidersHorizontal } from 'lucide-react';
import {
  type AgentKind,
  type TemplateVariable,
  hasChatCapability,
  hasImageCapability,
} from '@autix/shared-lib';
import { useChatStore } from '@autix/shared-store';
import { ImageParamsPopover } from './ImageParamsPopover';
import { TemplateGalleryDialog } from './TemplateGalleryDialog';
import { KIND_LABEL, isKindActive } from './agent-kind-utils';
import { VariableEditor } from '../template/VariableEditor';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../ui/popover';
import { Textarea } from '../ui/textarea';

interface ChatToolbarProps {
  kind: AgentKind;
  conversationId?: string;
  activeTemplateId?: string;
  activeTemplateName?: string;
  activeTemplatePrompt?: string;
  activeTemplateVariables?: TemplateVariable[];
  templateVariableValues: Record<string, string>;
  imageSize: string;
  imageQuality: string;
  imageCount: number;
  onTemplateVariableChange: (values: Record<string, string>) => void;
  onImageSizeChange: (v: string) => void;
  onImageQualityChange: (v: string) => void;
  onImageCountChange: (v: number) => void;
  onTemplateChanged: () => void;
}

export function ChatToolbar({
  kind,
  conversationId,
  activeTemplateId,
  activeTemplateName,
  activeTemplatePrompt,
  activeTemplateVariables = [],
  templateVariableValues,
  imageSize,
  imageQuality,
  imageCount,
  onTemplateVariableChange,
  onImageSizeChange,
  onImageQualityChange,
  onImageCountChange,
  onTemplateChanged,
}: ChatToolbarProps) {
  const {
    availableModels,
    selectedModelId,
    setSelectedModel,
    fetchAvailableModels,
  } = useChatStore();

  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  const filteredModels = availableModels.filter((m) => {
    const caps = m.capabilities ?? [];
    if (kind === 'image') return hasImageCapability(caps);
    if (kind === 'video') return caps.includes('video');
    return hasChatCapability(caps);
  });

  const selectedModel = filteredModels.find((m) => m.id === selectedModelId) ?? filteredModels[0];

  if (!isKindActive(kind)) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {KIND_LABEL[kind]}模块即将上线
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* Model Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setModelMenuOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card ${modelMenuOpen ? 'bg-card' : ''}`}
        >
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[120px] truncate">{selectedModel?.name ?? '选择模型'}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {modelMenuOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-2 max-h-60 w-56 overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg">
            {filteredModels.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                没有可用的{KIND_LABEL[kind]}模型
              </div>
            ) : (
              filteredModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setSelectedModel(model.id);
                    setModelMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-secondary ${
                    selectedModelId === model.id ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  <div className="font-medium">{model.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {model.model} · {model.provider}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Image-specific tools */}
      {kind === 'image' && (
        <>
          <ImageParamsPopover
            size={imageSize}
            quality={imageQuality}
            count={imageCount}
            onSizeChange={onImageSizeChange}
            onQualityChange={onImageQualityChange}
            onCountChange={onImageCountChange}
          />

          <button
            type="button"
            onClick={() => setTemplateGalleryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
          >
            <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-[100px] truncate">
              {activeTemplateName ?? '选模板'}
            </span>
          </button>

          {activeTemplatePrompt && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  模板 Prompt
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(560px,calc(100vw-32px))] p-0">
                <PopoverHeader>
                  <PopoverTitle>
                    {activeTemplateName ? `${activeTemplateName} · 模板 Prompt` : '模板 Prompt'}
                  </PopoverTitle>
                </PopoverHeader>
                <div className="p-3">
                  <Textarea
                    readOnly
                    value={activeTemplatePrompt}
                    className="h-[min(420px,55vh)] resize-none overflow-y-auto text-xs leading-5"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    这是当前图片模板自己的 prompt，会和变量、用户输入一起参与最终生图/修图提示词整理。
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {activeTemplateId && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  变量设置
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] p-0">
                <PopoverHeader>
                  <PopoverTitle>
                    {activeTemplateName ? `${activeTemplateName} · 变量设置` : '变量设置'}
                  </PopoverTitle>
                </PopoverHeader>
                <div className="max-h-[55vh] overflow-y-auto p-3">
                  {activeTemplateVariables.length > 0 ? (
                    <VariableEditor
                      variables={activeTemplateVariables}
                      values={templateVariableValues}
                      onChange={onTemplateVariableChange}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      当前模板没有可配置变量
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {conversationId && (
            <TemplateGalleryDialog
              open={templateGalleryOpen}
              onClose={() => setTemplateGalleryOpen(false)}
              kind="image"
              conversationId={conversationId}
              currentTemplateId={activeTemplateId}
              onSelected={onTemplateChanged}
            />
          )}
        </>
      )}
    </div>
  );
}
