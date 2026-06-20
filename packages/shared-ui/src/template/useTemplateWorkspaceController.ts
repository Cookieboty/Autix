'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  listAvailableModels,
  templateWorkspaceActions,
  useTemplateStore,
  type ModelConfigItem,
  type TemplateVariable,
} from '@autix/shared-store';
import {
  extractGeneratedImageUrls,
  getTemplateWorkspaceModelOptions,
  resolveTemplatePrompt,
  resolveTemplateWorkspaceImageConfig,
} from './template-workspace-presenter';

interface UseTemplateWorkspaceControllerArgs {
  generationId?: string;
  conversationId?: string | null;
  onOpenConversation: (conversationId: string) => void;
}

export function useTemplateWorkspaceController({
  generationId,
  conversationId = null,
  onOpenConversation,
}: UseTemplateWorkspaceControllerArgs) {
  const tWs = useTranslations('templateWorkspace');
  const {
    currentGeneration: gen,
    fetchGeneration,
    setCurrentGeneration,
    generating,
    setGenerating,
  } = useTemplateStore();

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
  const templateVarDefs: TemplateVariable[] = gen?.template?.variables ?? [];
  const templatePrompt = gen?.template?.prompt ?? '';

  useEffect(() => {
    if (generationId) fetchGeneration(generationId);
  }, [generationId, fetchGeneration]);

  useEffect(() => {
    listAvailableModels()
      .then((all) => {
        setImageModels(all.filter((model) => model.capabilities.includes('image')));
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
  const modelOptions = getTemplateWorkspaceModelOptions(imageModels);

  const handleVariableChange = (key: string, value: string) => {
    const updated = { ...variableValues, [key]: value };
    setVariableValues(updated);
    if (templatePrompt) {
      const newPrompt = resolveTemplatePrompt(templatePrompt, updated);
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

  const resolveAmuxConfig = useCallback(
    () => resolveTemplateWorkspaceImageConfig(imageModels, currentModel),
    [imageModels, currentModel],
  );

  const handleGenerate = async () => {
    const config = resolveAmuxConfig();
    if (!config || !gen) return;

    setGenerating(true);
    try {
      const res = await templateWorkspaceActions.generateImage(
        {
          model: currentModel,
          prompt: currentPrompt,
          n: 4,
          response_format: 'b64_json',
        },
        config,
      );
      const imageUrls = extractGeneratedImageUrls(res.data);

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

    await templateWorkspaceActions.addGenerationTurn(gen.id, {
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

      const chatRes = await templateWorkspaceActions.chat(
        { model: 'gpt-4o', messages, stream: false },
        config,
      );
      const chatData = chatRes.data as any;
      const newPrompt = (chatData?.choices?.[0]?.message?.content ?? currentPrompt) as string;

      setPromptInput(newPrompt);

      await templateWorkspaceActions.addGenerationTurn(gen.id, {
        role: 'ASSISTANT',
        content: `${tWs('refinedPromptPrefix')}\n${newPrompt}`,
      });

      const imgRes = await templateWorkspaceActions.generateImage(
        { model: currentModel, prompt: newPrompt, n: 4, response_format: 'b64_json' },
        config,
      );
      const newImages = extractGeneratedImageUrls(imgRes.data);

      await templateWorkspaceActions.addGenerationTurn(gen.id, {
        role: 'ASSISTANT',
        content: tWs('regeneratedMessage'),
        images: newImages,
      });

      await fetchGeneration(gen.id);
    } catch (err: any) {
      await templateWorkspaceActions.addGenerationTurn(gen.id, {
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
    const images = gen.generatedImages
      .map((src, index) => `![${tWs('generatedImageAlt', { index: index + 1 })}](${src})`)
      .join('\n');
    await templateWorkspaceActions.appendResultToConversation(conversationId, {
      content: tWs('sendGeneratedResultMessage', { prompt: gen.resolvedPrompt, images }),
      metadata: {
        source: 'image_template_generation',
        generationId: gen.id,
        templateId: gen.templateId,
        images: gen.generatedImages,
      },
    });
    onOpenConversation(conversationId);
  };

  return {
    gen,
    generating,
    chatInput,
    setChatInput,
    attachedImage,
    setAttachedImage,
    chatEndRef,
    editingModel,
    setEditingModel,
    modelInput,
    setModelInput,
    showModelDropdown,
    setShowModelDropdown,
    editingPrompt,
    setEditingPrompt,
    promptInput,
    setPromptInput,
    variableValues,
    templateVarDefs,
    currentModel,
    currentPrompt,
    modelOptions,
    handleVariableChange,
    handleModelSelect,
    handlePromptSave,
    handleGenerate,
    handleSendRefine,
    handleSendToConversation,
  };
}
