import type { ImageModelCapability } from './capabilities';
import { mapEquivalentSize } from './coerce';

export interface ImageSizeAspectOption {
  label: string;
  value: string;
  aspectValue: string;
  sourceLabel: string;
}

export interface ImageSizeResolutionGroup {
  label: string;
  value: string;
  options: ImageSizeAspectOption[];
}

export type ImagePricingResolution = '512px' | '1K' | '2K' | '4K';

interface ParsedSizeToken {
  width: number;
  height: number;
  tier?: string;
}

const KNOWN_TIER_ORDER = new Map([
  ['auto', -1],
  ['512px', 0],
  ['1K', 1],
  ['2K', 2],
  ['4K', 4],
]);

function parseSizeToken(value: string): ParsedSizeToken | null {
  if (value === 'auto') return null;
  const [pixelSize, tier] = value.split('@');
  const m = /^(\d+)x(\d+)$/.exec(pixelSize);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (width <= 0 || height <= 0) return null;
  return { width, height, tier };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function inferAspectLabel(value: string, label: string): string {
  const fromLabel = /^(\d+:\d+)/.exec(label.trim());
  if (fromLabel) return fromLabel[1];
  const parsed = parseSizeToken(value);
  if (!parsed) return label;
  const divisor = gcd(parsed.width, parsed.height);
  return `${parsed.width / divisor}:${parsed.height / divisor}`;
}

function inferResolution(value: string, label: string): { label: string; value: string } {
  if (value === 'auto') {
    return { label, value: 'auto' };
  }

  const parsed = parseSizeToken(value);
  if (!parsed) {
    return { label, value };
  }

  if (parsed.tier) {
    return { label: parsed.tier, value: parsed.tier };
  }

  const longerSide = Math.max(parsed.width, parsed.height);
  if (longerSide >= 3000) return { label: '4K', value: '4K' };
  if (longerSide >= 1900) return { label: '2K', value: '2K' };
  return { label: '1K', value: '1K' };
}

export function resolveImagePricingResolution(value: string | null | undefined): ImagePricingResolution | undefined {
  const text = String(value ?? '').trim();
  if (!text || text === 'auto') return undefined;
  const parsed = parseSizeToken(text);
  if (!parsed) return undefined;
  if (parsed.tier === '512px' || parsed.tier === '1K' || parsed.tier === '2K' || parsed.tier === '4K') {
    return parsed.tier;
  }
  const longerSide = Math.max(parsed.width, parsed.height);
  if (longerSide >= 3000) return '4K';
  if (longerSide >= 1900) return '2K';
  return '1K';
}

function resolutionSortValue(group: ImageSizeResolutionGroup, fallback: number): number {
  return KNOWN_TIER_ORDER.get(group.value) ?? fallback + 100;
}

export function buildImageSizeResolutionGroups(
  capability: Pick<ImageModelCapability, 'sizes'>,
): ImageSizeResolutionGroup[] {
  const order = new Map<string, number>();
  const groups = new Map<string, ImageSizeResolutionGroup>();

  capability.sizes.forEach((size, index) => {
    const resolution = inferResolution(size.value, size.label);
    const aspectLabel = inferAspectLabel(size.value, size.label);
    const group = groups.get(resolution.value) ?? {
      label: resolution.label,
      value: resolution.value,
      options: [],
    };
    if (!groups.has(resolution.value)) {
      order.set(resolution.value, index);
      groups.set(resolution.value, group);
    }
    group.options.push({
      label: aspectLabel,
      value: size.value,
      aspectValue: aspectLabel,
      sourceLabel: size.label,
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    const aOrder = resolutionSortValue(a, order.get(a.value) ?? 0);
    const bOrder = resolutionSortValue(b, order.get(b.value) ?? 0);
    return aOrder - bOrder;
  });
}

export function resolveImageSizeSelection(
  sizeValue: string,
  groups: ImageSizeResolutionGroup[],
): {
  group: ImageSizeResolutionGroup | null;
  option: ImageSizeAspectOption | null;
} {
  for (const group of groups) {
    const option = group.options.find((candidate) => candidate.value === sizeValue);
    if (option) return { group, option };
  }

  const group = groups[0] ?? null;
  return { group, option: group?.options[0] ?? null };
}

export function selectImageSizeResolution(
  currentSizeValue: string,
  nextResolutionValue: string,
  groups: ImageSizeResolutionGroup[],
): string {
  const current = resolveImageSizeSelection(currentSizeValue, groups);
  const nextGroup = groups.find((group) => group.value === nextResolutionValue);
  if (!nextGroup) return current.option?.value ?? currentSizeValue;

  const sameAspect = current.option
    ? nextGroup.options.find((option) => option.aspectValue === current.option?.aspectValue)
    : undefined;
  return sameAspect?.value ?? nextGroup.options[0]?.value ?? current.option?.value ?? currentSizeValue;
}

/**
 * The aspect-first pivot of {@link buildImageSizeResolutionGroups}: one entry per
 * distinct aspect ratio, taking the first occurrence's encoded value as a stand-in.
 * Used by UIs that expose aspect and resolution as two separate menus.
 */
export function getUniqueImageAspectOptions(
  groups: ImageSizeResolutionGroup[],
): ImageSizeAspectOption[] {
  const seen = new Map<string, ImageSizeAspectOption>();
  for (const group of groups) {
    for (const option of group.options) {
      if (!seen.has(option.aspectValue)) seen.set(option.aspectValue, option);
    }
  }
  return Array.from(seen.values());
}

/**
 * Switch the aspect ratio while keeping the current resolution tier when that
 * tier offers the requested aspect; otherwise fall back to any tier that has it.
 * Mirror of {@link selectImageSizeResolution} (which keeps aspect across tiers).
 */
export function selectImageSizeAspect(
  currentSizeValue: string,
  nextAspectValue: string,
  groups: ImageSizeResolutionGroup[],
): string {
  const current = resolveImageSizeSelection(currentSizeValue, groups);
  const sameResolution = current.group?.options.find(
    (option) => option.aspectValue === nextAspectValue,
  );
  if (sameResolution) return sameResolution.value;

  for (const group of groups) {
    const candidate = group.options.find((option) => option.aspectValue === nextAspectValue);
    if (candidate) return candidate.value;
  }

  return current.option?.value ?? currentSizeValue;
}

/**
 * Unified read-model for every image-size picker. Given a model capability and
 * the currently-stored value, this computes everything a renderer needs —
 * resolution tiers, deduped aspect options, the resolved selection, a summary
 * label, and a normalized value — plus the two change actions. Rendering stays
 * per-site (popover / sidebar / dual dropdown); this is the single source of the
 * *rules*.
 *
 * `value` is normalized via nearest-aspect mapping when `currentValue` is not a
 * legal option for this capability (e.g. right after switching models); callers
 * should persist `value` back through their onChange when `isValid` is false.
 */
export interface ImageSizeView {
  groups: ImageSizeResolutionGroup[];
  aspectOptions: ImageSizeAspectOption[];
  hasResolutionTiers: boolean;
  selectedTier: ImageSizeResolutionGroup | null;
  selectedAspect: ImageSizeAspectOption | null;
  displayLabel: string;
  value: string;
  isValid: boolean;
  pickAspect: (nextAspectValue: string) => string;
  pickResolution: (nextResolutionValue: string) => string;
}

export function buildImageSizeView(
  capability: ImageModelCapability,
  currentValue: string,
): ImageSizeView {
  const groups = buildImageSizeResolutionGroups(capability);
  const isValid = capability.sizes.some((option) => option.value === currentValue);
  const value = isValid ? currentValue : mapEquivalentSize(currentValue, capability);
  const selection = resolveImageSizeSelection(value, groups);

  return {
    groups,
    aspectOptions: getUniqueImageAspectOptions(groups),
    hasResolutionTiers: groups.length > 1,
    selectedTier: selection.group,
    selectedAspect: selection.option,
    displayLabel: selection.option?.sourceLabel ?? value,
    value,
    isValid,
    pickAspect: (nextAspectValue) => selectImageSizeAspect(value, nextAspectValue, groups),
    pickResolution: (nextResolutionValue) => selectImageSizeResolution(value, nextResolutionValue, groups),
  };
}
