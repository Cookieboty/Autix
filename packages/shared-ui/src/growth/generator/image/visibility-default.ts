export type ImageVisibility = 'private' | 'public';

/** autoPublish=ON → public，否则 fail-closed 到 private。 */
export function visibilityFromAutoPublish(autoPublish: boolean): ImageVisibility {
  return autoPublish ? 'public' : 'private';
}
