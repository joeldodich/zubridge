/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly vitest?: typeof import('vitest'); // Add this line
}

interface ImportMetaEnv {
  // Add other environment variables if needed
}
