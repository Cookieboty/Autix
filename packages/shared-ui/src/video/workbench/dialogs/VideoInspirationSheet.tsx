import { FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialAsset, MaterialAssetType } from '@autix/shared-store';
import type { VideoProject } from '@autix/shared-store';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../ui/sheet';
import {
  type MaterialTargetLabelMessages,
  type VideoInspirationTab,
  type VideoMaterialTarget,
  type WorkbenchVideoTemplate,
} from '../constants';
import { VideoInspirationHistory } from './VideoInspirationHistory';
import { VideoInspirationMaterials } from './VideoInspirationMaterials';
import { VideoInspirationTabs } from './VideoInspirationTabs';
import { VideoInspirationTemplates } from './VideoInspirationTemplates';

export function VideoInspirationSheet({
  open,
  onOpenChange,
  tab,
  onTabChange,
  templates,
  categories,
  templatesLoading,
  templateSearch,
  templateCategory,
  applyingId,
  onTemplateSearchChange,
  onTemplateCategoryChange,
  onApply,
  historyProjects,
  onSelectProject,
  materials,
  materialsLoading,
  materialSearch,
  materialType,
  materialTarget,
  onMaterialSearchChange,
  onMaterialTypeChange,
  onMaterialTargetChange,
  onUseMaterial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: VideoInspirationTab;
  onTabChange: (tab: VideoInspirationTab) => void;
  templates: WorkbenchVideoTemplate[];
  categories: string[];
  templatesLoading: boolean;
  templateSearch: string;
  templateCategory: string;
  applyingId: string | null;
  onTemplateSearchChange: (search: string) => void;
  onTemplateCategoryChange: (category: string) => void;
  onApply: (template: WorkbenchVideoTemplate) => void;
  historyProjects: VideoProject[];
  onSelectProject: (projectId: string) => void;
  materials: MaterialAsset[];
  materialsLoading: boolean;
  materialSearch: string;
  materialType: MaterialAssetType | 'all';
  materialTarget: VideoMaterialTarget;
  onMaterialSearchChange: (search: string) => void;
  onMaterialTypeChange: (type: MaterialAssetType | 'all') => void;
  onMaterialTargetChange: (target: VideoMaterialTarget) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet');
  const tTargets = useTranslations('videoWorkbench.materialTargets');
  const targetMessages: MaterialTargetLabelMessages = {
    firstFrame: tTargets('firstFrame'),
    lastFrame: tTargets('lastFrame'),
    referenceImage: tTargets('referenceImage'),
    referenceVideo: tTargets('referenceVideo'),
    referenceAudio: tTargets('referenceAudio'),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(94vw,560px)] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="size-4 text-primary" />
            {t('title')}
          </SheetTitle>
          <SheetDescription className="sr-only">{t('description')}</SheetDescription>
          <VideoInspirationTabs tab={tab} onTabChange={onTabChange} />
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'templates' ? (
            <VideoInspirationTemplates
              templates={templates}
              categories={categories}
              loading={templatesLoading}
              search={templateSearch}
              category={templateCategory}
              applyingId={applyingId}
              onSearchChange={onTemplateSearchChange}
              onCategoryChange={onTemplateCategoryChange}
              onApply={onApply}
            />
          ) : tab === 'history' ? (
            <VideoInspirationHistory projects={historyProjects} onSelectProject={onSelectProject} />
          ) : (
            <VideoInspirationMaterials
              materials={materials}
              loading={materialsLoading}
              search={materialSearch}
              type={materialType}
              target={materialTarget}
              onSearchChange={onMaterialSearchChange}
              onTypeChange={onMaterialTypeChange}
              onTargetChange={onMaterialTargetChange}
              onUseMaterial={onUseMaterial}
              targetMessages={targetMessages}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
