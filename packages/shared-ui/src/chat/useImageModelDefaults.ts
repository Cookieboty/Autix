'use client';

import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { listAvailableModels, type ModelConfigItem } from '@autix/shared-store';
import type { SourceImageRef } from './chat-source-images';

type ImageTemplateModelHint = {
  id?: string;
  modelHint?: string;
  variables?: Array<{ key?: string; default?: string }>;
};

export function useImageModelDefaults({
  imageTemplateResource,
  setSelectedModel,
  setSelectedSourceImages,
  setTemplateVariables,
}: {
  imageTemplateResource?: ImageTemplateModelHint;
  setSelectedModel: (id: string) => void;
  setSelectedSourceImages: Dispatch<SetStateAction<SourceImageRef[]>>;
  setTemplateVariables: (values: Record<string, string>) => void;
}) {
  const [imageModels, setImageModels] = useState<ModelConfigItem[]>([]);

  useEffect(() => {
    listAvailableModels()
      .then((availableModels) => {
        const models = availableModels.filter((m) =>
          Array.isArray(m.capabilities) && m.capabilities.includes('image'),
        );
        setImageModels(models);
      })
      .catch(() => setImageModels([]));
  }, []);

  useEffect(() => {
    if (!imageTemplateResource) {
      setSelectedSourceImages([]);
      return;
    }
    const defaults: Record<string, string> = {};
    for (const variable of imageTemplateResource.variables ?? []) {
      if (variable?.key) defaults[variable.key] = variable.default ?? '';
    }
    setTemplateVariables(defaults);
    const hint = imageTemplateResource.modelHint;
    const hinted = imageModels.find((m) =>
      hint && (m.model === hint || m.id === hint || m.name === hint),
    );
    const target = hinted ?? imageModels[0];
    if (target?.id) {
      setSelectedModel(target.id);
    }
  }, [imageTemplateResource?.id, imageTemplateResource?.modelHint, imageModels.length, setSelectedModel]);
}
