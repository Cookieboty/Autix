'use client';

import { useEffect, useRef, useState } from 'react';
import type { VideoTemplate } from '@autix/shared-store';
import { composeTemplatePrompt } from './utils/composeTemplatePrompt';
import type { useVideoInputController } from '../video/useVideoInputController';

type VideoInputController = ReturnType<typeof useVideoInputController>;

type PromptInject = {
  content: string;
  images?: string[];
  token: number;
} | null;

type TemplateVariableLike = {
  key?: string;
  default?: string;
};

type ImageTemplateLike = {
  id?: string;
  title?: string;
  prompt?: string;
  variables?: TemplateVariableLike[];
  coverImage?: string;
  modelHint?: string;
};

function getDefaultValues(variables?: TemplateVariableLike[]) {
  const defaultValues: Record<string, string> = {};
  for (const variable of variables ?? []) {
    if (variable?.key) defaultValues[variable.key] = variable.default ?? '';
  }
  return defaultValues;
}

export function useTemplatePromptState({
  activeImageTemplateId,
  activeVideoTemplateId,
  imageTemplateResource,
  videoTemplateResource,
  videoInput,
}: {
  activeImageTemplateId?: string;
  activeVideoTemplateId?: string;
  imageTemplateResource?: ImageTemplateLike;
  videoTemplateResource?: VideoTemplate;
  videoInput: VideoInputController;
}) {
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [selectedRefImages, setSelectedRefImages] = useState<string[]>([]);
  const [promptInject, setPromptInject] = useState<PromptInject>(null);
  const prevTemplateIdRef = useRef<string | undefined>(undefined);
  const prevVideoTemplateIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentTemplateId = activeImageTemplateId;
    if (currentTemplateId === prevTemplateIdRef.current) return;

    if (!currentTemplateId) {
      prevTemplateIdRef.current = undefined;
      setTemplateVariables({});
      setSelectedRefImages([]);
      setPromptInject(null);
      return;
    }

    const template = imageTemplateResource;
    if (!template) return;

    prevTemplateIdRef.current = currentTemplateId;

    const defaultValues = getDefaultValues(template.variables);
    setTemplateVariables(defaultValues);
    setSelectedRefImages([]);

    const composed = composeTemplatePrompt(template.prompt ?? '', defaultValues);
    setPromptInject((prev) => ({
      content: composed,
      token: (prev?.token ?? 0) + 1,
    }));
  }, [activeImageTemplateId, imageTemplateResource]);

  useEffect(() => {
    const currentId = activeVideoTemplateId;
    if (currentId === prevVideoTemplateIdRef.current) return;

    if (!currentId) {
      prevVideoTemplateIdRef.current = undefined;
      return;
    }

    const tpl = videoTemplateResource;
    if (!tpl) return;

    prevVideoTemplateIdRef.current = currentId;

    const dur = tpl.durationSec ?? 5;
    if (tpl.durationSec) videoInput.setDuration(dur);
    if (tpl.defaultParams?.ratio) videoInput.setRatio(tpl.defaultParams.ratio);
    const mode = (tpl.defaultParams?.mode ?? 'reference') as typeof videoInput.mode;
    if (tpl.defaultParams?.mode) videoInput.setModeRaw(mode);
    if (tpl.modelHint) videoInput.setModel(tpl.modelHint);

    videoInput.setMaterials([]);
    videoInput.resetFramesForMode(mode);

    const defaultValues = getDefaultValues(tpl.variables);
    setTemplateVariables(defaultValues);
    setSelectedRefImages([]);

    const composed = composeTemplatePrompt(tpl.prompt ?? '', defaultValues);
    setPromptInject((prev) => ({
      content: composed,
      token: (prev?.token ?? 0) + 1,
    }));

    setPromptDialogOpen(true);
  }, [activeVideoTemplateId, videoTemplateResource]);

  const clearPromptState = () => {
    setPromptInject(null);
    setSelectedRefImages([]);
  };

  return {
    templateVariables,
    setTemplateVariables,
    promptDialogOpen,
    setPromptDialogOpen,
    selectedRefImages,
    setSelectedRefImages,
    promptInject,
    setPromptInject,
    clearPromptState,
  };
}
