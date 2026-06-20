'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, ChevronDown, Pencil } from 'lucide-react';
import type { TemplateGeneration, TemplateVariable } from '@autix/shared-store';
import { Button } from '../ui';

interface TemplateWorkspaceSidebarProps {
  generation: TemplateGeneration;
  currentModel: string;
  modelOptions: string[];
  modelInput: string;
  editingModel: boolean;
  showModelDropdown: boolean;
  currentPrompt: string;
  promptInput: string;
  editingPrompt: boolean;
  templateVariables: TemplateVariable[];
  variableValues: Record<string, string>;
  onBackToDetail: (templateId: string) => void;
  onModelInputChange: Dispatch<SetStateAction<string>>;
  onEditingModelChange: Dispatch<SetStateAction<boolean>>;
  onShowModelDropdownChange: Dispatch<SetStateAction<boolean>>;
  onModelSelect: (model: string) => void;
  onPromptInputChange: Dispatch<SetStateAction<string>>;
  onEditingPromptChange: Dispatch<SetStateAction<boolean>>;
  onPromptSave: () => void;
  onVariableChange: (key: string, value: string) => void;
}

export function TemplateWorkspaceSidebar({
  generation,
  currentModel,
  modelOptions,
  modelInput,
  editingModel,
  showModelDropdown,
  currentPrompt,
  promptInput,
  editingPrompt,
  templateVariables,
  variableValues,
  onBackToDetail,
  onModelInputChange,
  onEditingModelChange,
  onShowModelDropdownChange,
  onModelSelect,
  onPromptInputChange,
  onEditingPromptChange,
  onPromptSave,
  onVariableChange,
}: TemplateWorkspaceSidebarProps) {
  const tWs = useTranslations('templateWorkspace');

  return (
    <aside
      className="w-[300px] flex-shrink-0 overflow-y-auto p-4 space-y-4"
      style={{ borderRight: '1px solid var(--border)' }}
    >
      <Button
        variant="ghost"
        className="cursor-pointer"
        onClick={() => onBackToDetail(generation.templateId)}
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> {tWs('backToDetail')}
      </Button>

      <div>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>
          {tWs('templateLabel')}
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {generation.template?.title ?? generation.templateId}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
          {tWs('modelLabel')}
        </p>
        <div className="relative">
          <button
            className="w-full flex items-center justify-between h-9 px-3 text-sm rounded-md cursor-pointer"
            style={{
              border: '1px solid var(--input-border)',
              backgroundColor: 'var(--input-bg)',
              color: 'var(--foreground)',
            }}
            onClick={() => onShowModelDropdownChange(!showModelDropdown)}
          >
            <span className="truncate">{currentModel}</span>
            <ChevronDown
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: 'var(--muted)' }}
            />
          </button>

          {showModelDropdown && (
            <div
              className="absolute z-10 mt-1 w-full rounded-md overflow-hidden shadow-lg"
              style={{
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--border)',
              }}
            >
              {modelOptions.map((model) => (
                <button
                  key={model}
                  className="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer flex items-center justify-between"
                  style={{
                    color: model === currentModel ? 'var(--accent)' : 'var(--foreground)',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.backgroundColor = 'var(--panel-muted)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => onModelSelect(model)}
                >
                  <span>{model}</span>
                  {model === currentModel && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
              <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
                <input
                  value={editingModel ? modelInput : ''}
                  onChange={(event) => {
                    onEditingModelChange(true);
                    onModelInputChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && modelInput.trim()) {
                      onModelSelect(modelInput.trim());
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

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
            {tWs('currentPrompt')}
          </p>
          <button
            className="p-1 rounded cursor-pointer"
            style={{ color: 'var(--muted)' }}
            onClick={() => {
              if (editingPrompt) {
                onPromptSave();
              } else {
                onPromptInputChange(currentPrompt);
                onEditingPromptChange(true);
              }
            }}
          >
            {editingPrompt ? (
              <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            ) : (
              <Pencil className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        {editingPrompt ? (
          <textarea
            value={promptInput}
            onChange={(event) => onPromptInputChange(event.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-md text-xs leading-5 outline-none resize-none"
            style={{
              backgroundColor: 'var(--input-bg)',
              color: 'var(--foreground)',
              fontFamily: 'monospace',
              border: '1px solid var(--accent)',
            }}
            onBlur={onPromptSave}
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
              onPromptInputChange(currentPrompt);
              onEditingPromptChange(true);
            }}
          >
            {currentPrompt}
          </div>
        )}
      </div>

      {templateVariables.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
            {tWs('variablesLabel')}
          </p>
          <div className="space-y-2.5">
            {templateVariables.map((varDef) => {
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
                      onChange={(event) => onVariableChange(varDef.key, event.target.value)}
                      className="w-full h-8 px-2 text-xs rounded-md outline-none cursor-pointer"
                      style={{
                        border: '1px solid var(--input-border)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--foreground)',
                      }}
                    >
                      {varDef.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={value}
                      onChange={(event) => onVariableChange(varDef.key, event.target.value)}
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
  );
}
