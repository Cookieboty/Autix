import type { AmuxModel } from '@autix/shared-store';

export type AmuxImportStep = 'loading' | 'auth' | 'select' | 'importing' | 'done';

export function filterAmuxModels(models: AmuxModel[], activeFilter: string): AmuxModel[] {
  return activeFilter === 'all'
    ? models
    : models.filter((model) => model.modality === activeFilter);
}

export function getAmuxModalities(models: AmuxModel[]): string[] {
  return Array.from(new Set(models.map((model) => model.modality))).sort();
}

export function areAllFilteredModelsSelected(
  filteredModels: AmuxModel[],
  selected: ReadonlySet<string>,
): boolean {
  return filteredModels.length > 0 && filteredModels.every((model) => selected.has(model.name));
}

export function toggleModelSelection(
  selected: ReadonlySet<string>,
  name: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}

export function toggleFilteredModelSelection(
  selected: ReadonlySet<string>,
  filteredModels: AmuxModel[],
  allFilteredSelected: boolean,
): Set<string> {
  const next = new Set(selected);
  if (allFilteredSelected) {
    filteredModels.forEach((model) => next.delete(model.name));
  } else {
    filteredModels.forEach((model) => next.add(model.name));
  }
  return next;
}
