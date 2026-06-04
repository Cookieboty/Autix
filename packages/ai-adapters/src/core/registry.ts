export class AdapterRegistry<T> {
  private readonly adapters = new Map<string, T>();
  private fallback: T | undefined;

  register(provider: string, adapter: T): this {
    this.adapters.set(provider, adapter);
    return this;
  }

  setFallback(adapter: T): this {
    this.fallback = adapter;
    return this;
  }

  resolve(provider: string): T {
    const adapter = this.adapters.get(provider) ?? this.fallback;
    if (!adapter) {
      throw new Error(`No adapter registered for provider "${provider}" and no fallback set`);
    }
    return adapter;
  }
}
