const clientEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_ENABLE_MODEL_CONFIG: process.env.NEXT_PUBLIC_ENABLE_MODEL_CONFIG,
  NEXT_PUBLIC_MODEL_CONFIG_ENABLED: process.env.NEXT_PUBLIC_MODEL_CONFIG_ENABLED,
  NEXT_PUBLIC_ENABLE_AMUX_MODEL_IMPORT: process.env.NEXT_PUBLIC_ENABLE_AMUX_MODEL_IMPORT,
  NEXT_PUBLIC_AMUX_MODEL_IMPORT_ENABLED: process.env.NEXT_PUBLIC_AMUX_MODEL_IMPORT_ENABLED,
};

function readBooleanEnv(keys: string[], defaultValue: boolean) {
  for (const key of keys) {
    const value = clientEnv[key];
    if (value == null || value === '') continue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  }
  return defaultValue;
}

export const MODEL_CONFIG_ENABLED = readBooleanEnv(
  ['NEXT_PUBLIC_ENABLE_MODEL_CONFIG', 'NEXT_PUBLIC_MODEL_CONFIG_ENABLED'],
  true,
);

export const AMUX_MODEL_IMPORT_ENABLED = readBooleanEnv(
  ['NEXT_PUBLIC_ENABLE_AMUX_MODEL_IMPORT', 'NEXT_PUBLIC_AMUX_MODEL_IMPORT_ENABLED'],
  true,
);
