import { ModelsView } from '@autix/shared-ui/models';

const DESKTOP_AMUX_API_URL = 'https://api.amux.ai';
const DESKTOP_MODEL_TYPE_OPTIONS = ['general', 'code', 'intent', 'embedding'];

export function ModelsPage() {
  return (
    <ModelsView
      amuxHost={DESKTOP_AMUX_API_URL}
      modelTypeOptions={DESKTOP_MODEL_TYPE_OPTIONS}
      variant="desktop"
      drawerMode="overlay"
    />
  );
}
