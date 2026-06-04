export interface ImageCallContext {
  baseUrl?: string;
  apiKey: string;
  model: string;
  prompt: string;
  count: number;
  size?: string;
  quality?: string;
  sourceImages?: Array<{ url: string; prompt?: string }>;
  referenceImages?: Array<{ url: string; prompt?: string }>;
  metadata?: Record<string, unknown>;
}

export interface ImageProviderAdapter {
  provider: string;
  generate(ctx: ImageCallContext): Promise<string[]>;
  edit(ctx: ImageCallContext): Promise<string[]>;
}
