'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Send, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DrawerShell,
  DrawerHero,
  DrawerBody,
  DrawerFooterRow,
} from '../drawer-shell';
import {
  useTemplateStore,
  type PromptTemplate,
  type TemplateVariable,
} from '@autix/shared-store';
import { TemplateFormFields } from './TemplateFormFields';
import { LEGACY_TEMPLATE_CATEGORY_VALUES } from './category-utils';

const CATEGORY_API_MAP = LEGACY_TEMPLATE_CATEGORY_VALUES;

interface TemplateFormDrawerProps {
  open: boolean;
  onClose: () => void;
  template?: PromptTemplate | null;
  onSaved?: () => void;
}

export function TemplateFormDrawer({ open, onClose, template, onSaved }: TemplateFormDrawerProps) {
  const t = useTranslations('template');
  const tCommon = useTranslations('common');
  const isEdit = !!template;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORY_API_MAP.portrait);
  const [prompt, setPrompt] = useState('');
  const [modelHint, setModelHint] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [exampleImages, setExampleImages] = useState<(string | undefined)[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);

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
      setCategory(CATEGORY_API_MAP['portrait']);
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
  const updateExampleImage = (i: number, url: string | undefined) => {
    const copy = [...exampleImages];
    copy[i] = url;
    setExampleImages(copy);
  };

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
        await updateTemplate(template.id, data);
      } else {
        await createTemplate(data);
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
          eyebrow={t('templateEyebrow')}
          title={isEdit ? t('editTemplate') : t('publishNewTemplate')}
          description={isEdit ? t('editDescription') : t('newDescription')}
        />
      }
      footer={
        <DrawerFooterRow
          aside={!isEdit ? t('reviewNote') : t('editSaveNote')}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="cursor-pointer" onClick={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="default"
                className="cursor-pointer"
                disabled={submitting || !title.trim() || !prompt.trim()}
                onClick={handleSubmit}
              >
                {isEdit ? <Save className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {submitting ? tCommon('processing') : isEdit ? tCommon('save') : t('submitForReview')}
              </Button>
            </div>
          }
        />
      }
    >
      <DrawerBody>
        <TemplateFormFields
          title={title}
          description={description}
          category={category}
          prompt={prompt}
          variables={variables}
          coverImage={coverImage}
          exampleImages={exampleImages}
          modelHint={modelHint}
          tags={tags}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onCategoryChange={setCategory}
          onPromptChange={setPrompt}
          onAddVariable={addVariable}
          onRemoveVariable={removeVariable}
          onVariableChange={updateVariable}
          onCoverImageChange={setCoverImage}
          onAddExampleSlot={addExampleSlot}
          onExampleImageChange={updateExampleImage}
          onModelHintChange={setModelHint}
          onTagsChange={setTags}
        />
      </DrawerBody>
    </DrawerShell>
  );
}
