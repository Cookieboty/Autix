/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_API_URL?: string;
  readonly VITE_USER_API_URL?: string;
  readonly VITE_AMUX_HOST?: string;
  readonly VITE_AMUX_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
