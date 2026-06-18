'use client';

import { useState, useEffect } from 'react';
import { LayoutTemplate, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { videoProjectApi } from '@autix/shared-lib';
import { useVideoProjectStore } from '@autix/shared-store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';

interface VideoTemplatePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
}

type TabId = 'presets' | 'workflows';

export function VideoTemplatePickerSheet({
  open,
  onOpenChange,
  conversationId,
}: VideoTemplatePickerSheetProps) {
  const t = useTranslations('videoWorkbench.legacy.templatePicker');
  const [activeTab, setActiveTab] = useState<TabId>('workflows');
  const [workflowTemplates, setWorkflowTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { createFromTemplate } = useVideoProjectStore();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    videoProjectApi.listWorkflowTemplates({ pageSize: 50 }).then((res) => {
      setWorkflowTemplates((res.data as any)?.items ?? []);
    }).finally(() => setLoading(false));
  }, [open]);

  const handleUseTemplate = async (templateId: string) => {
    await createFromTemplate(templateId, undefined, conversationId);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[520px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="flex gap-1 border-b border-border pb-2 pt-2">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'workflows'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            onClick={() => setActiveTab('workflows')}
          >
            <Layers className="size-3.5" />
            {t('workflowTemplates')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'presets'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            onClick={() => setActiveTab('presets')}
          >
            <LayoutTemplate className="size-3.5" />
            {t('parameterPresets')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50" />
            </div>
          )}

          {activeTab === 'workflows' && !loading && (
            <div className="grid grid-cols-2 gap-3">
              {workflowTemplates.map((tpl: any) => (
                <div key={tpl.id} className="rounded-lg border border-border p-3 space-y-2 hover:border-primary/40 transition-colors">
                  <div className="aspect-video rounded bg-muted flex items-center justify-center overflow-hidden">
                    {tpl.coverImage ? (
                      <img src={tpl.coverImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Layers className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium truncate">{tpl.title ?? tpl.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('clipCount', { count: tpl.clips?.length ?? '?' })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => handleUseTemplate(tpl.id)}
                  >
                    {t('useTemplate')}
                  </Button>
                </div>
              ))}
              {workflowTemplates.length === 0 && (
                <p className="col-span-2 text-center text-sm text-muted-foreground py-10">{t('emptyWorkflow')}</p>
              )}
            </div>
          )}

          {activeTab === 'presets' && !loading && (
            <div className="text-center text-sm text-muted-foreground py-10">
              {t('presetsComingSoon')}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
