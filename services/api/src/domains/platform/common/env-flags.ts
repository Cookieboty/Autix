export function readBooleanEnv(keys: string[], defaultValue: boolean): boolean {
  for (const key of keys) {
    const value = process.env[key];
    if (value == null || value === '') continue;

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }

  return defaultValue;
}

