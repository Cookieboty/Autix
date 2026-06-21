'use client';

import { ImageStudioWorkspace } from './ImageStudioWorkspace';
import { ImageWorkbenchErrorAlert } from './workbench/ImageWorkbenchErrorAlert';
import { ImageWorkbenchEstimateDialog } from './workbench/ImageWorkbenchEstimateDialog';
import {
  useImageWorkbenchController,
  type ImageWorkbenchControllerOptions,
} from './workbench/useImageWorkbenchController';
import { appendUniqueImageReference } from './workbench/references';

export type ImageWorkbenchViewProps = ImageWorkbenchControllerOptions;

export function ImageWorkbenchView(props: ImageWorkbenchViewProps) {
  const controller = useImageWorkbenchController(props);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {controller.error && (
        <ImageWorkbenchErrorAlert
          message={controller.error}
          onClose={() => controller.setError(null)}
        />
      )}

      {controller.loadingModels ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {controller.loadingWorkbenchLabel}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ImageStudioWorkspace
            imageModels={controller.imageModels}
            availableModels={controller.models}
            selectedModelId={controller.selectedModelId}
            selectedChatModelId={controller.selectedChatModelId}
            onModelChange={controller.setSelectedModelId}
            onChatModelChange={controller.setSelectedChatModelId}
            settings={controller.settings}
            onSettingsChange={controller.setSettings}
            selectedSourceImages={controller.selectedSourceImages}
            onRemoveSourceImage={(index) =>
              controller.setSelectedSourceImages((cur) =>
                cur.filter((_, i) => i !== index),
              )
            }
            onClearSourceImages={() => controller.setSelectedSourceImages([])}
            currentImages={controller.currentImages}
            historyItems={controller.historyItems}
            materialImages={
              controller.enableMaterials ? controller.materialImages : undefined
            }
            imageTemplates={controller.imageTemplates}
            initialTemplate={controller.initialTemplate}
            onClearTemplate={controller.handleClearTemplate}
            materialsLoading={
              controller.enableMaterials ? controller.materialsLoading : undefined
            }
            templatesLoading={controller.templatesLoading}
            isGenerating={controller.generating}
            estimatedGenerateCost={controller.quickEstimate?.estimatedCost ?? null}
            estimatingGenerateCost={controller.quickEstimateLoading}
            onGenerate={controller.handleGenerate}
            onRefinePrompt={controller.handleRefinePrompt}
            onMergeAnnotation={controller.handleMergeAnnotation}
            onSelectSourceImage={(image) =>
              controller.setSelectedSourceImages((cur) =>
                appendUniqueImageReference(cur, image),
              )
            }
            onSubmitFeedback={controller.handleSubmitFeedback}
            onAddImageToMaterial={
              controller.enableMaterials
                ? controller.handleAddImageToMaterial
                : undefined
            }
            onDeleteHistoryTask={
              controller.enableMaterials
                ? controller.handleDeleteHistoryTask
                : undefined
            }
            onSelectMaterialImage={
              controller.enableMaterials
                ? controller.handleSelectMaterialImage
                : undefined
            }
            onDeleteMaterialImage={
              controller.enableMaterials
                ? controller.handleDeleteMaterialImage
                : undefined
            }
          />
        </div>
      )}

      <ImageWorkbenchEstimateDialog
        open={controller.estimateOpen}
        onOpenChange={controller.handleEstimateOpenChange}
        estimateLoading={controller.estimateLoading}
        estimate={controller.estimate}
        accountBalance={controller.accountBalance}
        onConfirm={controller.confirmGenerate}
      />
    </div>
  );
}
