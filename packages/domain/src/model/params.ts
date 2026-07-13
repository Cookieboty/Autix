export function hasImageCapability(capabilities: string[]): boolean {
  return capabilities.includes('image');
}

export function hasChatCapability(capabilities: string[]): boolean {
  return (
    capabilities.includes('text') ||
    capabilities.includes('vision') ||
    capabilities.includes('code') ||
    capabilities.includes('reasoning') ||
    capabilities.length === 0
  );
}
