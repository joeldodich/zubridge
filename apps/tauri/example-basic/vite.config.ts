import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@zubridge/tauri': resolve(__dirname, '../../../packages/tauri/dist/index.js'),
      '@zubridge/tauri/main': resolve(__dirname, '../../../packages/tauri/dist/main.js'),
    },
  },
});
