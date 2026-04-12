/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_SOCIETY: string;
  readonly VITE_BASE_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
