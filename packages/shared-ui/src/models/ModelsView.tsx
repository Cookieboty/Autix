'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  createModelConfig as createModelApi,
  deleteModelConfig as deleteModelApi,
  listAllModelConfigs,
  updateModelConfig as updateModelApi,
  type ModelConfigItem,
} from '@autix/shared-store';
import { AmuxImportDialog } from './AmuxImportDialog';
import { ModelEditorDrawer } from './ModelEditorDrawer';
import { ModelsContent, ModelsHeader } from './ModelList';
import {
  buildModelPayload,
  createEmptyEditing,
  DEFAULT_MODEL_TYPE_OPTIONS,
  editingFromModel,
  type EditingModel,
  type ModelsDrawerMode,
  type ModelsViewVariant,
} from './model-editing';

interface ModelsViewProps {
  amuxHost: string;
  amuxClientId?: string;
  amuxModelImportEnabled?: boolean;
  drawerMode?: ModelsDrawerMode;
  headerLeading?: ReactNode;
  modelTypeOptions?: readonly string[];
  variant?: ModelsViewVariant;
}

export function ModelsView({
  amuxHost,
  amuxClientId,
  amuxModelImportEnabled = true,
  drawerMode = 'sheet',
  headerLeading,
  modelTypeOptions = DEFAULT_MODEL_TYPE_OPTIONS,
  variant = 'web',
}: ModelsViewProps) {
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EditingModel>(() => createEmptyEditing(amuxHost));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [amuxImportOpen, setAmuxImportOpen] = useState(false);

  const loadModels = useCallback(() => {
    setLoading(true);
    listAllModelConfigs()
      .then((data) => setModels(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const openCreate = () => {
    setEditing(createEmptyEditing(amuxHost));
    setDrawerOpen(true);
  };

  const openEdit = (model: ModelConfigItem) => {
    setEditing(editingFromModel(model));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(createEmptyEditing(amuxHost));
  };

  const handleSave = async () => {
    const payload = buildModelPayload(editing);

    try {
      if (editing.id) {
        await updateModelApi(editing.id, payload);
      } else {
        await createModelApi(payload);
      }
      closeDrawer();
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModelApi(id);
      setDeletingId(null);
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <ModelsHeader
          headerLeading={headerLeading}
          importEnabled={amuxModelImportEnabled}
          modelCount={models.length}
          onCreate={openCreate}
          onImportFromAmux={() => setAmuxImportOpen(true)}
          variant={variant}
        />

        <ModelsContent
          loading={loading}
          models={models}
          deletingId={deletingId}
          onEdit={openEdit}
          onDelete={(id) => setDeletingId(id)}
          onConfirmDelete={handleDelete}
          onCancelDelete={() => setDeletingId(null)}
          variant={variant}
        />
      </div>

      <ModelEditorDrawer
        open={drawerOpen}
        mode={drawerMode}
        editing={editing}
        onEditingChange={setEditing}
        onClose={closeDrawer}
        onSave={handleSave}
        modelTypeOptions={modelTypeOptions}
        variant={variant}
      />

      {amuxModelImportEnabled && (
        <AmuxImportDialog
          open={amuxImportOpen}
          onClose={() => setAmuxImportOpen(false)}
          onImported={loadModels}
          amuxHost={amuxHost}
          amuxClientId={amuxClientId}
        />
      )}
    </div>
  );
}
